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
	protoc \
		-I $(PROTO_DIR) \
		--go_out=$(GO_PB_DIR) \
		--go_opt=paths=source_relative \
		--go-grpc_out=$(GO_PB_DIR) \
		--go-grpc_opt=paths=source_relative \
		--go_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
		--go_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
		--go-grpc_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
		--go-grpc_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
		$(PROTO_DIR)/common/*.proto \
		$(PROTO_DIR)/user/*.proto
	# source_relative 按 proto 目录输出，mv 到包名目录
	@mv -f $(GO_PB_DIR)/user $(GO_PB_DIR)/userpb 2>/dev/null || true
	@mv -f $(GO_PB_DIR)/common $(GO_PB_DIR)/commonpb 2>/dev/null || true

# ==================== 清理 ====================
clean:
	rm -rf $(GEN_DIR)
