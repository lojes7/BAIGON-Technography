// 百工谱 — DataSourceService gRPC 实现（桩）

package com.baigon.datasource.grpc;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * DataSourceService gRPC 桩实现
 *
 * TODO: 当 proto stub 生成后，继承 DataSourceServiceGrpc.DataSourceServiceImplBase
 * 并实现所有 RPC 方法
 */
@Service
public class DataSourceGrpcService {

    private static final Logger log = LoggerFactory.getLogger(DataSourceGrpcService.class);

    public DataSourceGrpcService() {
        log.info("DataSourceGrpcService 初始化完成（桩模式）");
    }

    // TODO: 实现以下 gRPC 方法:
    // - ingestDocument()       → 数据导入 → 清洗管道
    // - getQualityReport()     → 质量评分查询
    // - rerunQualityCheck()    → 重新质量检测
    // - getReviewQueue()       → 复核队列查询
    // - submitReview()         → 提交复核结果
    // - getReviewHistory()     → 复核历史
    // - listDataSources()      → 数据源列表
}
