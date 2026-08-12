#!/bin/sh
# 百工谱 — 将 Debian 软件源切换到国内镜像，仅供 Docker 构建阶段使用。
set -eu

apt_mirror="${APT_MIRROR:-https://mirrors.tuna.tsinghua.edu.cn}"
apt_mirror="${apt_mirror%/}"

replace_source() {
    source_file="$1"
    [ -f "$source_file" ] || return 0

    # 同时兼容传统 sources.list 与 Debian 12+ 容器使用的 DEB822 sources 文件。
    sed -i \
        -e "s|http://deb.debian.org/debian-security|${apt_mirror}/debian-security|g" \
        -e "s|https://deb.debian.org/debian-security|${apt_mirror}/debian-security|g" \
        -e "s|http://security.debian.org/debian-security|${apt_mirror}/debian-security|g" \
        -e "s|https://security.debian.org/debian-security|${apt_mirror}/debian-security|g" \
        -e "s|http://deb.debian.org/debian|${apt_mirror}/debian|g" \
        -e "s|https://deb.debian.org/debian|${apt_mirror}/debian|g" \
        "$source_file"
}

for source_file in \
    /etc/apt/sources.list \
    /etc/apt/sources.list.d/*.list \
    /etc/apt/sources.list.d/*.sources
do
    replace_source "$source_file"
done
