from werkzeug.exceptions import NotFound, BadRequest

from src.repositories.blockchain_repository import BlockchainRepository


class BlockchainService:
    def __init__(self, fabric_client):
        self.repository = BlockchainRepository(fabric_client)

    def create_batch(self, data):
        if not data:
            raise BadRequest("Invalid payload")

        return self.repository.create_batch(data)

    def transfer_batch(self, data):
        if not data:
            raise BadRequest("Invalid payload")

        return self.repository.transfer_batch(data)

    def mark_batch_delivered(self, data):
        if "batch_id" not in data or "delivered_to_org_id" not in data:
            raise BadRequest("batch_id and delivered_to_org_id are required")

        return self.repository.mark_batch_delivered(
            data["batch_id"], data["delivered_to_org_id"]
        )

    def get_batch(self, batch_id: str):
        result = self.repository.get_batch(batch_id)
        if not result:
            raise NotFound("Batch not found")
        return result

    def get_batch_history(self, batch_id: str):
        return self.repository.get_batch_history(batch_id)
