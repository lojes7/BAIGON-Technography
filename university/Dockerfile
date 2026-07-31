# 百工谱 — university_service Dockerfile
# 多阶段构建：Maven 编译 + JRE 运行，最终镜像仅含运行时依赖

# ========== 阶段一：构建 ==========
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build

# 利用 Docker 层缓存，先拷贝 pom.xml 下载依赖
COPY pom.xml .
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><name>Aliyun</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml
RUN mvn dependency:go-offline -B

# 拷贝源码并打包
COPY src ./src
RUN mvn clean package -DskipTests -B

# ========== 阶段二：运行 ==========
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# 创建非 root 用户
RUN addgroup -S baigon && adduser -S baigon -G baigon

# 拷贝构建产物
COPY --from=builder /build/target/*.jar app.jar

# 切换为非 root 用户
USER baigon

# gRPC 端口 + HTTP 端口
EXPOSE 50056 8084

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
