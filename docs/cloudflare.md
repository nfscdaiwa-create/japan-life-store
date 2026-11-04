# Cloudflare 部署与用量说明

本项目按 Cloudflare 免费优先设计，使用 Workers Static Assets 展示页面、Worker 处理 API，预留 D1 与 R2。**此文档是部署步骤，不是部署完成记录：远程数据库、存储桶、真实支付、管理身份和用量提醒均未配置。**

## 1. 先部署结构预览

在自己的开发环境安装 Node.js 24 或以上，并使用与 nfsc 公司项目对应的 Cloudflare 账户。代码仓库为 [nfscdaiwa-create/japan-life-store](https://github.com/nfscdaiwa-create/japan-life-store)。

先运行本地检查：

```sh
npm run verify
```

首次使用 Wrangler 时登录并核对账户：

```sh
npx wrangler@4 login
npx wrangler@4 whoami
```

构建并发布预览：

```sh
npm run build
npx wrangler@4 deploy
```

`npx` 首次运行会下载 Wrangler 开发工具；它不是网站的运行时依赖。部署使用现有 `wrangler.jsonc`，名称为 `japan-life-store`，静态产物目录为 `dist/`。多账户环境需先确认所选 Cloudflare 账户，不要仅凭同名项目推断账户正确。

当前配置无需 D1／R2 即可展示结构预览。部署成功后，以 Wrangler 实际返回的地址为准，检查首页、商品列表、详情、购物袋、后台与 404；`/api/health` 应显示框架状态，商品接口在未绑定数据库时返回 503，管理和结算仍然关闭。

此操作发布的是预览。`noindex` 不等于私有访问；需要限制访问时另行配置真正的访问保护。项目没有新增自动 CI、自动部署或任何自动收费流程。

## 2. 后续接入 D1 与 R2

以下仅为后续配置示例，**没有执行这些创建或远程迁移命令**。先在正确账户核对资源名称、计划与计费状态。

```sh
npx wrangler@4 d1 create japan-life-store-db
npx wrangler@4 r2 bucket create japan-life-store-media
```

取得实际资源后，在现有 `wrangler.jsonc` 顶层补充以下字段，并保持原有 `assets` 配置。占位值必须替换为真实结果，不能直接用于部署：

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "japan-life-store-db",
      "database_id": "<创建后返回的真实 D1 数据库 ID>",
      "migrations_dir": "migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "<实际创建的 R2 存储桶名称>"
    }
  ]
}
```

绑定和资源核对无误后，才可对目标数据库执行迁移并重新部署：

```sh
npx wrangler@4 d1 migrations apply japan-life-store-db --remote
npm run build
npx wrangler@4 deploy
```

迁移创建 9 张业务表，不插入任何示例商品、库存或订单。空数据库可以返回空的真实目录，不能自动导入 `src/catalog.mjs`。绑定 R2 也不会自动完成图片上传、公开访问或后台素材管理；这些功能还需要实现。

接口和表结构见 [后端说明](backend.md)。Cloudflare 凭据应通过登录或环境秘密管理，不提交到仓库，也不放进静态页面。

## 3. 免费优先的配置原则

- 保留静态资源优先，仅让 `/api/*` 先调用 Worker。Cloudflare 官方说明静态资源请求免费；匹配 `run_worker_first` 的请求会执行 Worker，受其额度与计费规则约束。[静态资源费用与限制](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- 当前 AI 生成示意图片随静态资源发布。R2 留给后续真实商品图片；R2 的免费外发流量不表示存储与读写操作无限免费。[R2 费用说明](https://developers.cloudflare.com/r2/pricing/)
- D1 通过必要索引与有限分页减少读取；不为每次页面浏览写一条业务记录。实际读写额度按账户计划核对。[D1 费用说明](https://developers.cloudflare.com/d1/platform/pricing/)
- 不能把免费请求数直接换算成保证可承受的购买人数。浏览、搜索、商品读取、下单以及机器人流量使用的资源不同。

## 4. 提醒能力与实际边界

| 能力 | 官方说明与本项目状态 |
| --- | --- |
| 账户预算邮件 | 按量付费账户可配置预算邮件；通知有处理延迟，本身不会暂停服务或封顶费用。本项目未核实或配置账户提醒 |
| D1 免费额度通知 | 官方说明达到每日免费读写上限后会拒绝查询，并发送达到额度的邮件；这不是保证提前提醒。已有数据不会因额度达到而删除 |
| Workers／Durable Objects 支出策略 | 官方 API 提供通知与 `usage_block` 动作，适用产品范围有限，状态为异步估计；不能据此承诺 R2／D1 也有统一实时费用封顶。本项目未配置 |
| 自有后台提前预警 | 当前只有界面位置，没有采集程序、定时检查、接收地址或已启用阈值 |

正式接入监控时，应显示数据来源、统计周期、最后更新时间和连接状态。读取失败要显示“无法读取”，不能显示为零用量。启用通知后还需验证接收渠道，不能仅凭界面开关声称通知已生效。

官方参考（于 2026-11-04 核对；实际能力与费用以账户及最新官方文档为准）：

- [预算邮件设置](https://developers.cloudflare.com/billing/manage/budget-alerts/)
- [预算邮件按日处理及通知延迟](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/)
- [D1 免费读写额度执行与邮件通知](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [创建产品支出策略 API](https://developers.cloudflare.com/api/resources/billing/subresources/spend_policies/methods/create/)
- [Workers Static Assets 绑定](https://developers.cloudflare.com/workers/static-assets/binding/)

## 5. 真实营业前的接续工作

录入真实商品与规格，核对制造地、采购地、价格和库存；完成真正的管理员认证；实现服务端计价、库存预留与释放、订单处理和支付回调；补齐经营主体、配送、税费、售后及隐私资料；最后验证远程部署和完整购买流程。

这些工作没有包含在本次“框架预览已完成”的声明中。
