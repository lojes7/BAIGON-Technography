# 百工谱 — gateway_service
# 注意：build context 是仓库根目录（见 docker-compose.yml），以便读取 proto/ 接口定义。
# gRPC stub 在构建阶段自动生成，部署无需手动 make go。

FROM golang:1.26-trixie AS builder

WORKDIR /app

# 安装 protoc + Go 插件 + swag（构建期生成 gRPC stub / Swagger 文档用）
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler \
    && go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11 \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1 \
    && go install github.com/swaggo/swag/cmd/swag@v1.16.6 \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="$PATH:/go/bin"

WORKDIR /app/gateway
COPY gateway/go.mod gateway/go.sum ./
RUN go mod download

# 生成 gRPC stub（在镜像内完成，部署免手动 make go）
COPY proto/ /app/proto/
COPY gateway/ ./
RUN mkdir -p /app/gateway/pb \
    && protoc \
    -I /app/proto \
    --go_out=/app/gateway/pb --go_opt=paths=source_relative \
    --go-grpc_out=/app/gateway/pb --go-grpc_opt=paths=source_relative \
    --go_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
    --go_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
    --go_opt=Mcrawler/crawler.proto=baigon-technography/gateway/pb/crawlerpb \
    --go_opt=Mdata_source/data_source.proto=baigon-technography/gateway/pb/datasourcepb \
    --go_opt=Moccupation/occupation.proto=baigon-technography/gateway/pb/occupationpb \
    --go-grpc_opt=Muser/user.proto=baigon-technography/gateway/pb/userpb \
    --go-grpc_opt=Mcommon/evidence.proto=baigon-technography/gateway/pb/commonpb \
    --go-grpc_opt=Mcrawler/crawler.proto=baigon-technography/gateway/pb/crawlerpb \
    --go-grpc_opt=Mdata_source/data_source.proto=baigon-technography/gateway/pb/datasourcepb \
    --go-grpc_opt=Moccupation/occupation.proto=baigon-technography/gateway/pb/occupationpb \
    /app/proto/common/*.proto /app/proto/user/*.proto \
    /app/proto/crawler/*.proto /app/proto/data_source/*.proto /app/proto/occupation/*.proto \
    # source_relative 输出到 pb/user 等子目录，mv 对齐包名目录。
    # 注意：必须先 rm 旧目标再 mv——目标已存在时 mv 会嵌套成 userpb/user/，导致 go build 找不到包
    && rm -rf /app/gateway/pb/userpb /app/gateway/pb/commonpb /app/gateway/pb/crawlerpb /app/gateway/pb/datasourcepb /app/gateway/pb/occupationpb \
    && mv /app/gateway/pb/user /app/gateway/pb/userpb \
    && mv /app/gateway/pb/common /app/gateway/pb/commonpb \
    && mv /app/gateway/pb/crawler /app/gateway/pb/crawlerpb \
    && mv /app/gateway/pb/data_source /app/gateway/pb/datasourcepb \
    && mv /app/gateway/pb/occupation /app/gateway/pb/occupationpb

# 生成 Swagger 文档（main.go blank import 了 docs 包，必须在 go build 前生成）
RUN swag init -g cmd/main.go -o docs/

# 编译 gateway（pb 与 docs 已生成）
RUN CGO_ENABLED=0 GOOS=linux go build -o /gateway ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /gateway /usr/local/bin/gateway
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/gateway"]
