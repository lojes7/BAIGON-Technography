# 百工谱 — ai_service gRPC 服务端桩实现

import logging

logger = logging.getLogger(__name__)


class AIServicer:
    """AIService gRPC 实现（桩）"""

    def ExtractJobInfo(self, request, context):
        logger.info("ExtractJobInfo 被调用")

    def ExtractResume(self, request, context):
        logger.info("ExtractResume 被调用")

    def ExtractPolicy(self, request, context):
        logger.info("ExtractPolicy 被调用")

    def EmbedText(self, request, context):
        logger.info("EmbedText 被调用")

    def BatchEmbedText(self, request, context):
        logger.info("BatchEmbedText 被调用")

    def LinkEntity(self, request, context):
        logger.info("LinkEntity 被调用")

    def GetExtractionConfidence(self, request, context):
        logger.info("GetExtractionConfidence 被调用")
