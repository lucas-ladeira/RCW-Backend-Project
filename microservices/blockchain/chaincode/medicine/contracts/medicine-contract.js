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
    unitPrice,
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

    const unitPriceNumber = parseFloat(unitPrice);
    if (isNaN(unitPriceNumber) || unitPriceNumber <= 0) {
      throw new Error('unitPrice must be a positive number');
    }

    const now = new Date().toISOString();

    const batch = {
      batchId,
      productName,
      manufactureDate,
      expiryDate,
      totalQuantity: totalQuantityNumber,
      unitDosage,
      unitPrice: unitPriceNumber,  // IMMUTABLE - cannot be changed after creation
      status: 'CREATED',              // CREATED | IN_TRANSIT | DELIVERED | CONSUMED
      ownerships: [                   // Track ownership distribution
        {
          orgId: ownerOrgId,
          quantity: totalQuantityNumber
        }
      ],
      lastTransfer: null,             // will be updated in transfers
      transfers: [],                  // Full history of transfers
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
   * Transfer a batch (or partial quantity) from one organization to another.
   * Validates supply chain order and prevents tampering.
   */
  async transferBatch(ctx, batchId, fromOrgId, toOrgId, quantityStr, transferMetadataJson) {
    const batch = await this.readBatchInternal(ctx, batchId);

    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    // Find fromOrg ownership
    const fromOwnership = batch.ownerships.find(o => o.orgId === fromOrgId);
    if (!fromOwnership) {
      throw new Error(`Organization ${fromOrgId} does not own any of batch ${batchId}`);
    }

    if (fromOwnership.quantity < quantity) {
      throw new Error(
        `Insufficient quantity. ${fromOrgId} owns ${fromOwnership.quantity}, trying to transfer ${quantity}`
      );
    }

    // Validate supply chain order
    this._validateSupplyChainOrder(fromOrgId, toOrgId);

    // Validate that critical fields cannot be changed (immutability check)
    if (batch.unitPrice === undefined || batch.unitPrice === null) {
      throw new Error('Unit price is not set - batch integrity compromised');
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
      quantity,
      timestamp: now,
      metadata
    };

    // Update ownerships
    fromOwnership.quantity -= quantity;

    // Remove ownership if quantity becomes 0
    if (fromOwnership.quantity === 0) {
      batch.ownerships = batch.ownerships.filter(o => o.orgId !== fromOrgId);
    }

    // Add or update toOrg ownership
    const toOwnership = batch.ownerships.find(o => o.orgId === toOrgId);
    if (toOwnership) {
      toOwnership.quantity += quantity;
    } else {
      batch.ownerships.push({
        orgId: toOrgId,
        quantity
      });
    }

    batch.status = 'IN_TRANSIT';
    batch.lastTransfer = transferRecord;
    batch.updatedAt = now;

    // Keep transfer history
    if (!Array.isArray(batch.transfers)) {
      batch.transfers = [];
    }
    batch.transfers.push(transferRecord);

    await this.writeBatchInternal(ctx, batch);
    return JSON.stringify(batch);
  }

  /**
   * Validate that the transfer follows the correct supply chain order.
   * manufacturer -> distributor -> pharmacy -> consumer
   */
  _validateSupplyChainOrder(fromOrgId, toOrgId) {
    const supplyChainRoles = {
      manufacturer: 1,
      distributor: 2,
      pharmacy: 3,
      consumer: 4
    };

    // Extract role from orgId (assumes format like "Org1MSP" or "manufacturer-org1")
    const getRole = (orgId) => {
      const lowerId = orgId.toLowerCase();
      if (lowerId.includes('manufacturer')) return supplyChainRoles.manufacturer;
      if (lowerId.includes('distributor')) return supplyChainRoles.distributor;
      if (lowerId.includes('pharmacy') || lowerId.includes('pharmacist')) return supplyChainRoles.pharmacy;
      if (lowerId.includes('consumer')) return supplyChainRoles.consumer;
      // Default fallback - could be more strict
      return 0;
    };

    const fromRole = getRole(fromOrgId);
    const toRole = getRole(toOrgId);

    if (fromRole === 0 || toRole === 0) {
      // Cannot determine roles - allow but log warning
      console.warn(`Cannot validate supply chain order for ${fromOrgId} -> ${toOrgId}`);
      return;
    }

    // Ensure transfer goes forward in the chain (or same level for returns)
    if (toRole < fromRole) {
      throw new Error(
        `Invalid supply chain order: cannot transfer from ${fromOrgId} (level ${fromRole}) to ${toOrgId} (level ${toRole}). ` +
        `Transfers must go forward in the chain: manufacturer -> distributor -> pharmacy -> consumer`
      );
    }

    // Prevent skipping levels (unless going from manufacturer directly to pharmacy in special cases)
    if (toRole - fromRole > 1 && !(fromRole === 1 && toRole === 3)) {
      throw new Error(
        `Invalid supply chain order: cannot skip intermediate steps from ${fromOrgId} to ${toOrgId}`
      );
    }
  }

  /**
   * Mark batch as delivered to final consumer or pharmacy.
   */
  async markBatchDelivered(ctx, batchId, deliveredToOrgId, quantityStr) {
    const batch = await this.readBatchInternal(ctx, batchId);

    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    const ownership = batch.ownerships.find(o => o.orgId === deliveredToOrgId);
    if (!ownership) {
      throw new Error(
        `Cannot mark delivered: ${deliveredToOrgId} does not own any of batch ${batchId}`
      );
    }

    if (ownership.quantity < quantity) {
      throw new Error(
        `Cannot mark delivered: ${deliveredToOrgId} owns ${ownership.quantity}, trying to deliver ${quantity}`
      );
    }

    // Reduce quantity from ownership
    ownership.quantity -= quantity;
    if (ownership.quantity === 0) {
      batch.ownerships = batch.ownerships.filter(o => o.orgId !== deliveredToOrgId);
    }

    // If all ownerships are depleted, mark as fully delivered
    if (batch.ownerships.length === 0) {
      batch.status = 'DELIVERED';
    }

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
