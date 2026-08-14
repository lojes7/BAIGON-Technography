# syntax=docker/dockerfile:1.7

# 百工谱 — user_service
# 注意：build context 是仓库根目录（见 docker-compose.yml），以便读取 proto/ 接口定义

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY user/pom.xml pom.xml
COPY docker/maven/settings.xml /app/maven-settings.xml
COPY proto/user/ ./proto/user/
COPY proto/common/ ./proto/common/
COPY user/src/ ./src/

# 与 occupation 共享 Maven 下载缓存，两个 Java 服务不再重复拉取公共依赖。
RUN mvn --settings /app/maven-settings.xml package -DskipTests -B -ntp

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50055 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
