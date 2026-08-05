# 百工谱 — data_source_service
# 注意：build context 是仓库根目录（见 docker-compose.yml），以便读取 proto/ 接口定义

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY data-source/pom.xml pom.xml
COPY proto/ ./proto/
# 配置阿里云 Maven 镜像，解决国内下载 jar 包不稳定问题
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><name>Aliyun Central</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml
RUN mvn dependency:go-offline -B
COPY data-source/src/ ./src/
# -Dproto.root=proto：Docker 中 proto 在 /app/proto（见 pom.xml 的 ${proto.root} 说明）
RUN mvn package -DskipTests -Dproto.root=proto -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50052 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
