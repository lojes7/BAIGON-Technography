# 百工谱 — occupation_service

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><name>Aliyun</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml
RUN mvn dependency:go-offline -B
COPY src/ ./src/
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50054 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
