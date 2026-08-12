# 百工谱 — occupation_service
# build context 为仓库根目录，以便在镜像内编译 proto。

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY occupation/pom.xml pom.xml
COPY proto/ ./proto/
RUN mkdir -p /root/.m2
COPY docker/maven/settings.xml /app/maven-settings.xml

RUN mvn --settings /app/maven-settings.xml dependency:go-offline -Dproto.root=proto -B
COPY occupation/src/ ./src/
RUN mvn --settings /app/maven-settings.xml package -DskipTests -Dproto.root=proto -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50054 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
