# 百工谱 — crawler_service gRPC 服务端桩实现

import logging

logger = logging.getLogger(__name__)


class CrawlerServicer:
    """
    CrawlerService gRPC 实现（桩）

    TODO: 当 proto 生成代码就绪后，继承生成的 Servicer 基类
    当前为独立实现，提供占位方法供 gRPC server 注册使用。
    """

    def StartCrawl(self, request, context):
        """启动采集任务"""
        logger.info("StartCrawl 被调用")
        # TODO: 实现采集逻辑

    def StopCrawl(self, request, context):
        """停止采集任务"""
        logger.info("StopCrawl 被调用")

    def GetCrawlStatus(self, request, context):
        """查询采集状态"""
        logger.info("GetCrawlStatus 被调用")

    def ListSourceRegistries(self, request, context):
        """列出数据源注册"""
        logger.info("ListSourceRegistries 被调用")
