'use strict';

const { Contract } = require('fabric-contract-api');

class MedicineContract extends Contract {

  async initLedger(ctx) {
    // Optional: you can preload demo data here if needed
    console.info('Ledger initialization: no default data.');
  }

  // ---------- Utility methods ----------

  async batchExists(ctx, batchId) {
    const buffer = await ctx.stub.getState(batchId);
    return buffer && buffer.length > 0;
  }

  async readBatchInternal(ctx, batchId) {
    const batchBuffer = await ctx.stub.getState(batchId);
    if (!batchBuffer || batchBuffer.length === 0) {
      throw new Error(`Batch ${batchId} does not exist`);
    }
    return JSON.parse(batchBuffer.toString());
  }

  async writeBatchInternal(ctx, batch) {
    if (!batch || !batch.batchId) {
      throw new Error('Batch object must have a batchId property');
    }
    await ctx.stub.putState(batch.batchId, Buffer.from(JSON.stringify(batch)));
  }

  // ---------- Smart contract business methods ----------

  /**
   * Create a new medicine batch.
   * Only manufacturers should be allowed to call this (enforced by client-side or by attributes).
   */
  async createBatch(
    ctx,
    batchId,
    productName,
    manufactureDate,
    expiryDate,
    totalQuantity,
    unitDosage,
    ownerOrgId
  ) {
    const exists = await this.batchExists(ctx, batchId);
    if (exists) {
      throw new Error(`Batch ${batchId} already exists`);
    }

    const totalQuantityNumber = parseInt(totalQuantity, 10);
    if (isNaN(totalQuantityNumber) || totalQuantityNumber <= 0) {
      throw new Error('totalQuantity must be a positive integer');
    }

    const now = new Date().toISOString();

    const batch = {
      batchId,
      productName,
      manufactureDate,
      expiryDate,
      totalQuantity: totalQuantityNumber,
      unitDosage,
      currentOwnerOrgId: ownerOrgId,
      status: 'CREATED',              // CREATED | IN_TRANSIT | DELIVERED | CONSUMED
      lastTransfer: null,             // will be updated in transfers
      createdAt: now,
      updatedAt: now
    };

    await this.writeBatchInternal(ctx, batch);
    return JSON.stringify(batch);
  }

  /**
   * Get batch data by id.
   */
  async getBatch(ctx, batchId) {
    const batch = await this.readBatchInternal(ctx, batchId);
    return JSON.stringify(batch);
  }

  /**
   * Transfer a batch from one organization to another.
   * In this first version we assume the whole batch moves together (no partial split).
   */
  async transferBatch(ctx, batchId, fromOrgId, toOrgId, transferMetadataJson) {
    const batch = await this.readBatchInternal(ctx, batchId);

    if (batch.currentOwnerOrgId !== fromOrgId) {
      throw new Error(
        `Invalid owner. Batch ${batchId} belongs to ${batch.currentOwnerOrgId}, not ${fromOrgId}`
      );
    }

    const now = new Date().toISOString();
    let metadata = {};

    if (transferMetadataJson) {
      try {
        metadata = JSON.parse(transferMetadataJson);
      } catch (err) {
        throw new Error('transferMetadataJson is not valid JSON');
      }
    }

    const transferRecord = {
      fromOrgId,
      toOrgId,
      timestamp: now,
      metadata
    };

    batch.currentOwnerOrgId = toOrgId;
    batch.status = 'IN_TRANSIT';
    batch.lastTransfer = transferRecord;
    batch.updatedAt = now;

    // Optional: keep a transfer history inside the batch object
    if (!Array.isArray(batch.transfers)) {
      batch.transfers = [];
    }
    batch.transfers.push(transferRecord);

    await this.writeBatchInternal(ctx, batch);
    return JSON.stringify(batch);
  }

  /**
   * Mark batch as delivered to final consumer or pharmacy.
   */
  async markBatchDelivered(ctx, batchId, deliveredToOrgId) {
    const batch = await this.readBatchInternal(ctx, batchId);

    if (batch.currentOwnerOrgId !== deliveredToOrgId) {
      throw new Error(
        `Cannot mark delivered: current owner is ${batch.currentOwnerOrgId}, not ${deliveredToOrgId}`
      );
    }

    batch.status = 'DELIVERED';
    batch.updatedAt = new Date().toISOString();

    await this.writeBatchInternal(ctx, batch);
    return JSON.stringify(batch);
  }

  /**
   * Get full on-chain history of a batch.
   * This is very useful for traceability and audits.
   */
  async getBatchHistory(ctx, batchId) {
    const exists = await this.batchExists(ctx, batchId);
    if (!exists) {
      throw new Error(`Batch ${batchId} does not exist`);
    }

    const iterator = await ctx.stub.getHistoryForKey(batchId);
    const history = [];

    // Loop through all historical states
    while (true) {
      const res = await iterator.next();

      if (res.value && res.value.value) {
        const txId = res.value.txId;
        const timestamp = res.value.timestamp;
        let value = res.value.value.toString('utf8');

        let parsedValue = null;
        try {
          parsedValue = JSON.parse(value);
        } catch (err) {
          parsedValue = value;
        }

        history.push({
          txId,
          timestamp: timestamp.seconds
            ? new Date(timestamp.seconds * 1000).toISOString()
            : null,
          value: parsedValue,
          isDelete: res.value.isDelete
        });
      }

      if (res.done) {
        await iterator.close();
        break;
      }
    }

    return JSON.stringify(history);
  }
}

module.exports = MedicineContract;
