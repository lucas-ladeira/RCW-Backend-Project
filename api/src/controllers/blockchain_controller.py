from werkzeug.exceptions import BadRequest, NotFound
from marshmallow.exceptions import ValidationError

from src.services.blockchain_service import BlockchainService
from src.models.blockchain_model import (
    CreateBatchDTO,
    TransferBatchDTO,
    batch_output,
)
from src.utils.api_response import ApiResponse


class BlockchainController:
    """
    Controller layer for blockchain endpoints.
    It translates HTTP-level payloads into DTOs and calls the service.
    """

    def __init__(self, fabric_client=None):
        self.blockchain_service = BlockchainService(fabric_client)

    def create_batch(self, data):
        try:
            payload = CreateBatchDTO().load(data)
            result = self.blockchain_service.create_batch(payload)
            return ApiResponse.response(True, "Batch created", result, 201)

        except ValidationError as e:
            return ApiResponse.response(False, e.messages, None, 400)

        except Exception:
            return ApiResponse.response(False, "Error creating batch", None, 500)

    def transfer_batch(self, data):
        try:
            payload = TransferBatchDTO().load(data)
            result = self.blockchain_service.transfer_batch(payload)
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
            return ApiResponse.response(False, "Error retrieving batch", None, 500)

    def get_batch_history(self, batch_id):
        try:
            result = self.blockchain_service.get_batch_history(batch_id)
            return ApiResponse.response(True, "Batch history loaded", result, 200)

        except NotFound:
            return ApiResponse.response(False, "Batch not found", None, 404)

        except Exception:
            return ApiResponse.response(False, "Error retrieving history", None, 500)
