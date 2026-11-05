FROM eclipse-temurin:8-jre-jammy

RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/softj
COPY server.py ./
COPY vendor/ ./vendor/
ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 3000
CMD ["python3", "server.py"]
