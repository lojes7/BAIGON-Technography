# 百工谱 — data_source_service
# 注意：build context 是仓库根目录（见 docker-compose.yml），以便读取 proto/ 接口定义

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY data-source/pom.xml pom.xml
COPY proto/ ./proto/

RUN mkdir -p /root/.m2
COPY docker/maven/settings.xml /app/maven-settings.xml

RUN mvn --settings /app/maven-settings.xml dependency:go-offline -B
COPY data-source/src/ ./src/
# -Dproto.root=proto：Docker 中 proto 在 /app/proto（见 pom.xml 的 ${proto.root} 说明）
RUN mvn --settings /app/maven-settings.xml package -DskipTests -Dproto.root=proto -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50052 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
