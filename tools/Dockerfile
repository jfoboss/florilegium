# TeX Live 2023 (Ubuntu 24.04) for building florilegium without a local TeX install:
#   docker build -t florilegium-tex tools && make RUN=tools/in-docker
# The base image is pinned by digest, so every build starts from the same Ubuntu image (the
# packages apt installs still come from the current archive). To move it, use the digest that
# `docker buildx imagetools inspect ubuntu:24.04` prints.
FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      texlive-luatex texlive-latex-recommended texlive-latex-extra texlive-pictures \
      texlive-fonts-recommended lmodern cm-super make poppler-utils python3 python3-pil \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
