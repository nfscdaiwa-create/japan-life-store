# 五物所：Cloudflare 部署、域名与用量说明

更新：2026-11-04 22:10（北京时间，Asia/Shanghai）。本轮品牌方向为 **五物所 / WUWUSUO**，目标域名为 `wuwusuo.com`。

本项目按 Cloudflare 免费优先设计，使用 Workers Static Assets 展示页面、Worker 处理 API，预留 D1 与 R2。**此文档是部署步骤，不是部署完成记录：远程数据库、存储桶、真实支付、管理身份和用量提醒均未配置。**

**当前域名未购买、未绑定。** 此前 Cloudflare 安全登录已被拒绝；本轮推进注册时又停在平台安全验证，流程已停止，没有登录、进入付款、接受条款、购买、新建 Site、修改 DNS 或部署。现有代码未填写 Custom Domain 路由或实际 account、zone、D1 资源 ID。以下账户操作是后续执行步骤，不能当作本轮已执行事项。名称与此前报价快照见 [域名实施计划](domain-plan.md)。

### 本轮实际执行状态（2026-11-04，北京时间）

在 [Cloudflare 官方公开查询页](https://www.cloudflare.com/domains/search?q=wuwusuo.com) 确认 `wuwusuo.com` 仍显示 Buy now，首年与续费报价均为 $11.17 USD。进入注册入口后，页面持续显示“正在进行安全验证／防护恶意自动程序”，正常刷新一次仍未放行；已记录 `purchase_blocked` 并停止该站注册流程。

这次尝试没有完成身份验证、付款、条款接受、购买或绑定，不代表已有域名所有权或可用的账户连接。后续不会在本轮继续重试认证或换注册渠道；只记录公开入口，不保留带临时参数的注册返回地址。

## 1. 先部署结构预览

在自己的开发环境安装 Node.js 24 或以上，并使用与 nfsc 公司项目对应的 Cloudflare 账户。代码仓库为 [nfscdaiwa-create/japan-life-store](https://github.com/nfscdaiwa-create/japan-life-store)。

先运行本地检查：

```sh
npm run verify
```

后续由可以管理公司账户的操作者在自己的环境完成认证，再核对目标账户；本轮不重新发起登录：

```sh
npx wrangler@4 whoami
```

构建并发布预览：

```sh
npm run build
npx wrangler@4 deploy
```

`npx` 首次运行会下载 Wrangler 开发工具；它不是网站的运行时依赖。部署使用现有 `wrangler.jsonc`，名称为 `japan-life-store`，静态产物目录为 `dist/`。多账户环境需先确认所选 Cloudflare 账户，并核实目标 Worker；本地名称不能证明远程实例已经存在，也不能只凭同名项目推断账户正确。

`japan-life-store` 是技术服务名称，`五物所 / WUWUSUO` 是站内品牌，二者可以不同；`/api/health` 的 `service` 也是技术标识。保留同一仓库与服务，不因品牌切换另外新建站点。启用 `workers.dev` 时，Worker 名称最多 63 个字符，仅支持英文字母、数字和连字符，不能以连字符开头或结尾；当前名称符合这一命名形式。实际 Worker 名称与 Wrangler 配置应一致。[workers.dev 命名规则](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) · [Workers Builds 名称要求](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/)

当前配置无需 D1／R2 即可展示结构预览。部署成功后，以 Wrangler 实际返回的地址为准，检查首页、商品列表、详情、购物袋、后台与 404；`/api/health` 应显示框架状态，商品接口在未绑定数据库时返回 503，管理和结算仍然关闭。

此操作发布的是预览。`noindex` 不等于私有访问；需要限制访问时另行配置真正的访问保护。项目没有新增自动 CI、自动部署或任何自动收费流程。

## 2. 注册后绑定 wuwusuo.com，沿用同一站点

### 2.1 先核实所有权、zone 与目标 Worker

完成实际注册后，核实公司能管理 `wuwusuo.com`，并在承接本项目的 Cloudflare 账户中确认 zone 已启用。若域名在其他注册商购买，应先完成该 zone 的接入及所有权检查，再进入绑定步骤。域名注册、zone 启用、Worker 发布是分别需要核实的状态。

Cloudflare Custom Domains 需要已启用的 zone 与目标 Worker；不能添加不属于自己的 zone，也不能直接绑定已有 CNAME 记录的主机名。遇到现有 DNS 记录时，先核对其用途，不覆盖未知业务记录。[Custom Domains 官方要求](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

### 2.2 把主域与 www 接到同一个 Worker

选中已经核实的本项目 Worker，在 **Settings → Domains & Routes → Add → Custom Domain** 添加 `wuwusuo.com`，再添加 `www.wuwusuo.com`。Cloudflare 会为 Custom Domain 生成 DNS 记录和所需证书；不用另建站点，也不需要编造源站地址。检查两个主机名的绑定和证书状态。

若后续选择用 Wrangler 管理路由，把以下字段合并到现有配置，保留原有 `name`、`main` 和 `assets`；此示例**尚未写入当前配置，也尚未部署**：

```json
{
  "routes": [
    { "pattern": "wuwusuo.com", "custom_domain": true },
    { "pattern": "www.wuwusuo.com", "custom_domain": true }
  ]
}
```

Custom Domain 的 `pattern` 是精确主机名，不加 `https://` 或 `/*`。两个主机名共用同一部署，页面、商品路径和 `/api` 都留在这套应用中。`assets.run_worker_first` 继续只匹配 `/api` 与 `/api/*`，不扩大到全部静态请求。以上配置形状及多域名支持见 [官方 Custom Domain 配置](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

### 2.3 统一到 HTTPS 主域

目标主地址为 `https://wuwusuo.com`。确认 HTTPS 证书可用且 SSL/TLS 未关闭后，在 **SSL/TLS → Edge Certificates** 启用 **Always Use HTTPS**；它把 HTTP 请求转到 HTTPS。[官方说明](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)

在该 zone 的 Single Redirects 创建 `www` 到主域的规则，沿用 Cloudflare 官方的保留路径方案：

| 设置 | 本项目值 |
| --- | --- |
| 匹配类型 | Wildcard pattern |
| Request URL | `http*://www.wuwusuo.com/*` |
| Target URL | `https://wuwusuo.com/${2}` |
| Status code | `301` |
| Preserve query string | Enabled |

这里 `${2}` 对应路径部分，不能直接把所有请求重定向到首页。规则根据 [官方跨主机名重定向示例](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-all-different-hostname/) 填入本项目主机名，尚未在账户中创建。预期 `https://www.wuwusuo.com/catalog/?category=home` 到达 `https://wuwusuo.com/catalog/?category=home`，商品路径和查询参数同样保留。

正式主域验证完成后，再决定是否关闭或保护 `workers.dev` 预览入口，并使 Wrangler 的 `workers_dev` 设置与账户保持一致。关闭 `workers.dev` 不等于关闭全部版本或预览 URL；本轮未改变任何入口。[官方入口说明](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

### 2.4 元信息与远程验收

域名实际绑定、HTTPS 和页面访问通过后，再把生产绝对 URL 统一到 `https://wuwusuo.com`：页面 canonical、`og:url` 和分享图片地址使用对应页面与已发布资源，品牌名称统一为五物所 / WUWUSUO。不能把不同商品或内容页都 canonical 到首页，也不能把未购买的目标域名写成“已上线”记录。

筹备预览继续保留 HTML `noindex`、静态及 API 的 `X-Robots-Tag` 和 robots 限制。域名绑定本身不改变这项策略；以后开放公开索引时，应按页面范围统一调整并生成 sitemap，购物袋、收藏、后台与 API 继续排除。支付和管理 API 仍保持关闭。

后续实际验收至少覆盖：

- 主域与 `www` 的 HTTP／HTTPS 组合，检查最终地址、证书和重定向循环；带分类参数及商品深层路径检查路径不丢失。
- 首页、分类、商品详情、购物袋、后台、静态资源和不存在的页面；不存在的页面必须保留 404 状态。
- `/api` 返回 JSON 404；`/api/health` 返回框架状态；未绑定 D1 时正式目录返回 503；管理和结算保持关闭；API 响应不缓存并禁止索引。
- 页面 CSP、品牌元信息与规范地址；前端演示数据、金额及颜色行为使用最终部署产物重新检查。

浏览器的示例购物袋和收藏按来源站点保存，从预览域切换到正式域不会自动同步。本轮保留现有预览数据，不为域名准备执行清空或跨站迁移。正式绑定记录应补充实际主机名、目标 Worker、验证结果和北京时间，而不是仅记录一段准备好的配置。

## 3. 后续接入 D1 与 R2

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

## 4. 免费优先的配置原则

- 保留静态资源优先，仅让 `/api` 与 `/api/*` 先调用 Worker。Cloudflare 官方说明静态资源请求免费；匹配 `run_worker_first` 的请求会执行 Worker，受其额度与计费规则约束。[静态资源费用与限制](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- 当前 AI 生成示意图片随静态资源发布。R2 留给后续真实商品图片；R2 的免费外发流量不表示存储与读写操作无限免费。[R2 费用说明](https://developers.cloudflare.com/r2/pricing/)
- D1 通过必要索引与有限分页减少读取；不为每次页面浏览写一条业务记录。实际读写额度按账户计划核对。[D1 费用说明](https://developers.cloudflare.com/d1/platform/pricing/)
- 不能把免费请求数直接换算成保证可承受的购买人数。浏览、搜索、商品读取、下单以及机器人流量使用的资源不同。

## 5. 提醒能力与实际边界

| 能力 | 官方说明与本项目状态 |
| --- | --- |
| 账户预算邮件 | 按量付费账户可配置预算邮件；通知有处理延迟，本身不会暂停服务或封顶费用。本项目未核实或配置账户提醒 |
| D1 免费额度通知 | 官方说明达到每日免费读写上限后会拒绝查询，并发送达到额度的邮件；这不是保证提前提醒。已有数据不会因额度达到而删除 |
| Workers／Durable Objects 支出策略 | 官方 API 提供通知与 `usage_block` 动作，适用产品范围有限，状态为异步估计；不能据此承诺 R2／D1 也有统一实时费用封顶。本项目未配置 |
| 自有后台提前预警 | 当前只有界面位置，没有采集程序、定时检查、接收地址或已启用阈值 |

正式接入监控时，应显示数据来源、统计周期、最后更新时间和连接状态。读取失败要显示“无法读取”，不能显示为零用量。启用通知后还需验证接收渠道，不能仅凭界面开关声称通知已生效。

以下为 2026-11-04 的既有用量资料核查记录；本轮只补核域名接入、HTTPS 与 Worker 命名要求，没有重新核验账户能力或用量价格：

- [预算邮件设置](https://developers.cloudflare.com/billing/manage/budget-alerts/)
- [预算邮件按日处理及通知延迟](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/)
- [D1 免费读写额度执行与邮件通知](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [创建产品支出策略 API](https://developers.cloudflare.com/api/resources/billing/subresources/spend_policies/methods/create/)
- [Workers Static Assets 绑定](https://developers.cloudflare.com/workers/static-assets/binding/)

## 6. 真实营业前的接续工作

录入真实商品与规格，核对制造地、采购地、价格和库存；完成真正的管理员认证；实现服务端计价、库存预留与释放、订单处理和支付回调；补齐经营主体、配送、税费、售后及隐私资料；最后验证远程部署和完整购买流程。

这些工作没有包含在本次“框架预览已完成”的声明中。
