# 百工谱 — occupation_service
# build context 为仓库根目录，以便在镜像内编译 proto。

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY occupation/pom.xml pom.xml
COPY proto/ ./proto/
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><name>Aliyun Central</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml
RUN mvn dependency:go-offline -Dproto.root=proto -B
COPY occupation/src/ ./src/
RUN mvn package -DskipTests -Dproto.root=proto -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50054 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
