# 百工谱 — occupation 合并服务
# build context 为仓库根目录，以便在镜像内编译三套服务端及内部客户端 proto。

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY occupation/pom.xml pom.xml
COPY docker/maven/settings.xml /app/maven-settings.xml
COPY proto/data_source/ ./proto/data_source/
COPY proto/occupation/ ./proto/occupation/
COPY proto/user/ ./proto/user/
COPY proto/crawler/ ./proto/crawler/
COPY proto/ai/ ./proto/ai/
COPY occupation/src/ ./src/

RUN mvn --settings /app/maven-settings.xml package \
    -DskipTests -Dproto.root=proto -B -ntp

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50054 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
