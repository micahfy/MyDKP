#!/bin/bash

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="/var/www/MyDKP/MyDKP-main"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}开始部署 MirAcLe DKP 系统${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. 进入项目目录
cd $PROJECT_DIR || exit 1
echo -e "${YELLOW}当前目录: $(pwd)${NC}"

# 2. 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}错误: .env 文件不存在！${NC}"
    echo -e "${YELLOW}请从 .env.example 复制并配置 .env 文件${NC}"
    exit 1
fi

# 3. 清理旧的构建
echo -e "${YELLOW}清理旧的构建文件...${NC}"
rm -rf .next

# 4. 构建项目
echo -e "${YELLOW}开始构建项目...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 5. 检查 standalone 目录
if [ ! -d ".next/standalone" ]; then
    echo -e "${RED}错误: .next/standalone 目录不存在！${NC}"
    exit 1
fi

# 6. 复制必要的文件到 standalone 目录
echo -e "${YELLOW}复制静态资源...${NC}"

# 复制 public 文件
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo -e "${GREEN}✓ 复制 public 文件夹${NC}"
fi

# 复制 .next/static 文件
if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/
    echo -e "${GREEN}✓ 复制 .next/static 文件夹${NC}"
fi

# 7. 复制 Prisma 文件
echo -e "${YELLOW}复制 Prisma 文件...${NC}"
cp -r prisma .next/standalone/
cp .env .next/standalone/

# 8. 确保数据库已初始化
echo -e "${YELLOW}检查数据库...${NC}"
if [ ! -f "prisma/prod.db" ]; then
    echo -e "${YELLOW}初始化数据库...${NC}"
    npx prisma db push
    npx prisma db seed
fi

# 9. 创建日志目录
mkdir -p logs

# 10. 停止旧的 PM2 进程
echo -e "${YELLOW}停止旧的 PM2 进程...${NC}"
pm2 delete dkp-manager 2>/dev/null || true

# 11. 启动新进程
echo -e "${YELLOW}启动新进程...${NC}"
pm2 start ecosystem.config.js

# 12. 保存 PM2 配置
pm2 save

# 13. 显示状态
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
pm2 logs dkp-manager --lines 20

echo -e "${YELLOW}查看实时日志: pm2 logs dkp-manager${NC}"
echo -e "${YELLOW}查看状态: pm2 ls${NC}"
echo -e "${YELLOW}重启应用: pm2 restart dkp-manager${NC}"