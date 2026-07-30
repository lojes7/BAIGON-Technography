# ===========================================
# 第一阶段：Maven 构建
# ===========================================
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build
COPY pom.xml .
# 预下载依赖（利用 Docker 层缓存）
RUN mvn dependency:go-offline -B

COPY src/ ./src/
RUN mvn package -DskipTests -B

# ===========================================
# 第二阶段：运行时镜像
# ===========================================
FROM eclipse-temurin:21-jre-alpine

# 创建非 root 用户 baigon
RUN addgroup -S baigon && adduser -S baigon -G baigon

WORKDIR /app

# 从构建阶段复制 jar
COPY --from=builder /build/target/file-service-*.jar app.jar

# 切换到非 root 用户
USER baigon

# gRPC 端口 50057，HTTP 端口 8085
EXPOSE 50057 8085

ENTRYPOINT ["java", "-jar", "app.jar"]
