# 百工谱 — Proto 编译脚本
# 运行: make all

PROTO_DIR := .
GEN_DIR := gen

# 服务列表（university 已合并进 user）
SERVICES := common crawler data_source ai occupation user file

.PHONY: all clean python java go

all: python java go

# ==================== 生成目录 ====================
$(GEN_DIR):
	mkdir -p $(GEN_DIR)

# ==================== Python stub ====================a
python: $(GEN_DIR)
	@echo "=== 生成 Python gRPC stub ==="
	python -m grpc_tools.protoc \
		-I $(PROTO_DIR) \
		--python_out=$(GEN_DIR)/python \
		--grpc_python_out=$(GEN_DIR)/python \
		$(PROTO_DIR)/common/*.proto \
		$(PROTO_DIR)/crawler/*.proto \
		$(PROTO_DIR)/data_source/*.proto \
		$(PROTO_DIR)/ai/*.proto \
		$(PROTO_DIR)/occupation/*.proto \
		$(PROTO_DIR)/user/*.proto \
		$(PROTO_DIR)/university/*.proto \
		$(PROTO_DIR)/file/*.proto
	# 修复 import 路径
	@for f in $$(find $(GEN_DIR)/python -name '*_pb2_grpc.py'); do \
		sed -i '' 's/import common_pb2/from . import common_pb2/' $$f 2>/dev/null || true; \
	done

# ==================== Python stub（crawler 服务专用） ====================
# 与 gateway 的 pb 命名保持一致，生成到 crawler/src/pb/（gitignored，构建前需先运行 make python-crawler）
python-crawler: $(GEN_DIR)
	@echo "=== 生成 crawler Python gRPC stub (crawler/src/pb) ==="
	@mkdir -p $(GEN_DIR)/python-crawler
	python -m grpc_tools.protoc \
		-I $(PROTO_DIR) \
		--python_out=$(GEN_DIR)/python-crawler \
		--grpc_python_out=$(GEN_DIR)/python-crawler \
		$(PROTO_DIR)/common/*.proto \
		$(PROTO_DIR)/crawler/*.proto
	@mkdir -p ../crawler/src/pb
	# grpc_tools.protoc 按 proto 目录结构输出（common/、crawler/ 子目录），cp 各文件到目标
	@cp $(GEN_DIR)/python-crawler/crawler/crawler_pb2.py $(GEN_DIR)/python-crawler/crawler/crawler_pb2_grpc.py \
		$(GEN_DIR)/python-crawler/common/evidence_pb2.py $(GEN_DIR)/python-crawler/common/evidence_pb2_grpc.py \
		../crawler/src/pb/
	# 相对导入修复（生成代码是 from common import evidence_pb2 as xxx 形式，改为包内相对导入）
	@cd ../crawler/src/pb && \
		sed -i '' 's/^from common import evidence_pb2 as common_dot_evidence__pb2/from . import evidence_pb2 as common_dot_evidence__pb2/' crawler_pb2.py && \
		sed -i '' 's/^from crawler import crawler_pb2 as crawler_dot_crawler__pb2/from . import crawler_pb2 as crawler_dot_crawler__pb2/' crawler_pb2_grpc.py
	@touch ../crawler/src/pb/__init__.py
	@echo "crawler python stub 已生成到 crawler/src/pb"

# ==================== Java stub ====================
java: $(GEN_DIR)
	@echo "=== 生成 Java gRPC stub ==="
	protoc \
		-I $(PROTO_DIR) \
		--java_out=$(GEN_DIR)/java \
		--grpc-java_out=$(GEN_DIR)/java \
		$(PROTO_DIR)/common/*.proto \
		$(PROTO_DIR)/crawler/*.proto \
		$(PROTO_DIR)/data_source/*.proto \
		$(PROTO_DIR)/ai/*.proto \
		$(PROTO_DIR)/occupation/*.proto \
		$(PROTO_DIR)/user/*.proto \
		$(PROTO_DIR)/university/*.proto \
		$(PROTO_DIR)/file/*.proto

# ==================== Go stub ====================
# 目前只有 gateway（Go）消费 stub，直接生成到 gateway/pb/ 下
# import path 与目录名必须一致（userpb / commonpb）
GO_PB_DIR := ../gateway/pb
go:
	@echo "=== 生成 Go gRPC stub (gateway/pb) ==="
	@mkdir -p $(GO_PB_DIR)
	protoc \
		-I $(PROTO_DIR) \
		--go_out=$(GO_PB_DIR) \
		--go_opt=paths=source_relative \
		--go-grpc_out=$(GO_PB_DIR) \
		--go-grpc_opt=paths=source_relative \
		--go_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
		--go_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
		--go_opt=Mcrawler/crawler.proto=baigon-technography/gateway/pb/crawlerpb \
		--go_opt=Mdata_source/data_source.proto=baigon-technography/gateway/pb/datasourcepb \
		--go-grpc_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
		--go-grpc_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
		--go-grpc_opt=Mcrawler/crawler.proto=baigon-technography/gateway/pb/crawlerpb \
		--go-grpc_opt=Mdata_source/data_source.proto=baigon-technography/gateway/pb/datasourcepb \
		$(PROTO_DIR)/common/*.proto \
		$(PROTO_DIR)/user/*.proto \
		$(PROTO_DIR)/crawler/*.proto \
		$(PROTO_DIR)/data_source/*.proto
	# source_relative 按 proto 目录输出，mv 到包名目录
	# 注意：目标已存在时 mv 会嵌套目录，必须先清理旧目录
	@rm -rf $(GO_PB_DIR)/userpb $(GO_PB_DIR)/commonpb $(GO_PB_DIR)/crawlerpb $(GO_PB_DIR)/datasourcepb
	@mv -f $(GO_PB_DIR)/user $(GO_PB_DIR)/userpb 2>/dev/null || true
	@mv -f $(GO_PB_DIR)/common $(GO_PB_DIR)/commonpb 2>/dev/null || true
	@mv -f $(GO_PB_DIR)/crawler $(GO_PB_DIR)/crawlerpb 2>/dev/null || true
	@mv -f $(GO_PB_DIR)/data_source $(GO_PB_DIR)/datasourcepb 2>/dev/null || true

# ==================== 清理 ====================
clean:
	rm -rf $(GEN_DIR)
