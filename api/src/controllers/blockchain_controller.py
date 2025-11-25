from config.fabric_config import get_fabric_client
from src.services.blockchain_service import BlockchainService
from src.utils.api_response import ApiResponse
from marshmallow.exceptions import ValidationError
from werkzeug.exceptions import NotFound, BadRequest

from src.models.blockchain_model import CreateBatchDTO, TransferBatchDTO


class BlockchainController:
    def __init__(self):
        self.fabric_client = get_fabric_client()
        self.blockchain_service = BlockchainService(self.fabric_client)

    def create_batch(self, data):
        try:
            dto = CreateBatchDTO().load(data)
            result = self.blockchain_service.create_batch(dto)
            return ApiResponse.response(True, "Batch created", result, 201)
        except ValidationError as e:
            return ApiResponse.response(False, e.messages, None, 400)
        except Exception:
            return ApiResponse.response(False, "Error creating batch", None, 500)

    def transfer_batch(self, data):
        try:
            dto = TransferBatchDTO().load(data)
            result = self.blockchain_service.transfer_batch(dto)
            return ApiResponse.response(True, "Batch transferred", result, 200)
        except ValidationError as e:
            return ApiResponse.response(False, e.messages, None, 400)
        except Exception:
            return ApiResponse.response(False, "Error transferring batch", None, 500)

    def mark_batch_delivered(self, data):
        try:
            result = self.blockchain_service.mark_batch_delivered(data)
            return ApiResponse.response(True, "Batch delivered", result, 200)
        except BadRequest as e:
            return ApiResponse.response(False, e.description, None, 400)
        except Exception:
            return ApiResponse.response(False, "Error marking batch delivered", None, 500)

    def get_batch(self, batch_id):
        try:
            result = self.blockchain_service.get_batch(batch_id)
            return ApiResponse.response(True, "Batch found", result, 200)
        except NotFound:
            return ApiResponse.response(False, "Batch not found", None, 404)
        except Exception:
            return ApiResponse.response(False, "Error loading batch", None, 500)

    def get_batch_history(self, batch_id):
        try:
            result = self.blockchain_service.get_batch_history(batch_id)
            return ApiResponse.response(True, "Batch history loaded", result, 200)
        except NotFound:
            return ApiResponse.response(False, "Batch not found", None, 404)
        except Exception:
            return ApiResponse.response(False, "Error loading history", None, 500)
