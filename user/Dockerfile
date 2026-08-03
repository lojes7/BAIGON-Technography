# 百工谱 — user_service
# 注意：build context 是仓库根目录（见 docker-compose.yml），以便读取 proto/ 接口定义

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY user/pom.xml pom.xml
COPY proto/ ./proto/
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><name>Aliyun Central</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml
RUN mvn dependency:go-offline -B
COPY user/src/ ./src/
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50055 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
