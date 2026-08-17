# 百工谱 — occupation 合并服务
# build context 为仓库根目录，以便在镜像内编译三套服务端及内部客户端 proto。

FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY occupation/pom.xml pom.xml
COPY docker/maven/settings.xml /app/maven-settings.xml
COPY occupation/src/ ./src/

COPY proto/data_source/ ./proto/data_source/
COPY proto/occupation/ ./proto/occupation/
COPY proto/user/ ./proto/user/
COPY proto/crawler/ ./proto/crawler/
COPY proto/ai/ ./proto/ai/

RUN mvn package \
    -DskipTests -Dproto.root=proto -B -ntp

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# OCR 在运行阶段执行，因此 Tesseract 与语言包必须安装到最终镜像。
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-chi_sim \
    tesseract-ocr-data-eng

RUN addgroup --system baigon && adduser --system --ingroup baigon baigon
USER baigon
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 50054 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
