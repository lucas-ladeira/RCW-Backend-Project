from werkzeug.exceptions import NotFound, BadRequest
from src.repositories.blockchain_repository import BlockchainRepository
from src.services.auth_service import AuthService
from src.utils.constants import UserRole


class BlockchainService:
    def __init__(self, fabric_client):
        self.repository = BlockchainRepository(fabric_client)
        self.auth_service = AuthService()

    def _get_current_user(self):
        user = self.auth_service.return_user_from_token()
        if user is None:
            raise BadRequest("Authentication required")
        return user

    def create_batch(self, data):
        user = self._get_current_user()
        if user.role not in [UserRole.ADMIN.value, UserRole.MANUFACTURER.value]:
            raise BadRequest("You are not allowed to create batches")

        if not data:
            raise BadRequest("Invalid payload")

        return self.repository.create_batch(data)

    def transfer_batch(self, data):
        user = self._get_current_user()
        if user.role not in [
            UserRole.ADMIN.value,
            UserRole.MANUFACTURER.value,
            UserRole.DISTRIBUTOR.value,
            UserRole.PHARMACIST.value,
        ]:
            raise BadRequest("You are not allowed to transfer batches")

        if not data:
            raise BadRequest("Invalid payload")

        return self.repository.transfer_batch(data)

    def mark_batch_delivered(self, data):
        user = self._get_current_user()
        if user.role not in [UserRole.ADMIN.value, UserRole.PHARMACIST.value]:
            raise BadRequest("You are not allowed to mark delivery")

        if "batch_id" not in data or "delivered_to_org_id" not in data:
            raise BadRequest("batch_id and delivered_to_org_id are required")

        return self.repository.mark_batch_delivered(
            data["batch_id"], data["delivered_to_org_id"]
        )

    def get_batch(self, batch_id: str):
        # You can decide: allow all authenticated users
        user = self._get_current_user()
        result = self.repository.get_batch(batch_id)
        if not result:
            raise NotFound("Batch not found")
        return result

    def get_batch_history(self, batch_id: str):
        user = self._get_current_user()
        return self.repository.get_batch_history(batch_id)
