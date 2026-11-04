# 后端框架说明

本版完成 Cloudflare Worker 路由、真实商品只读接口与 D1 初始表结构。**尚未创建远程 D1/R2、接通收款、启用后台登录或开放真实订单。** 前台的演示商品与购物车预览不写入本数据库。

## 1. 各层职责

| 层 | 作用 | 当前实现 |
| --- | --- | --- |
| 静态前台 | 首页、分类、商品、购物车和中文后台结构预览 | 由项目构建到 `dist/`，Cloudflare Static Assets 托管 |
| Worker | API 路由、参数校验、统一错误处理 | `worker/index.mjs`，无第三方运行时依赖 |
| D1 | 商品、规格、库存、订单、支付事件和设置 | `migrations/0001_initial.sql`；未插入演示或真实经营数据 |
| R2 | 未来的正式商品图片 | 预留 `MEDIA` 绑定及图片 `object_key`，未开放上传或公开读取端点 |
| 交易与管理身份 | 订单创建、支付回调、权限校验 | 保持关闭；不能用请求头或环境开关绕过 |

静态请求通过 `ASSETS.fetch(request)` 交给 Cloudflare 的静态资源服务；配置 `assets.run_worker_first` 匹配 `/api` 与 `/api/*`，使接口与静态页面分开处理。绑定与调用方式参照 [Cloudflare 静态资源绑定文档](https://developers.cloudflare.com/workers/static-assets/binding/)。

## 2. 绑定约定

| 绑定 | 类型 | 未配置时的行为 |
| --- | --- | --- |
| `ASSETS` | Workers Static Assets | Worker 回退静态请求时返回 503 |
| `DB` | D1 Database | 商品接口返回 503 `CATALOG_NOT_CONFIGURED` |
| `MEDIA` | R2 Bucket | 健康接口如实显示未配置，不生成虚构的图片 URL |

`GET /api/health` 的 `configured` 只表示检测到相应绑定，不表示已验证远程可用性、迁移完成或额度充足。不要把健康页解读成营业就绪检查。

## 3. API 约定

成功：`{"ok":true,"data":{...}}`。失败：`{"ok":false,"error":{"code":"...","message":"中文说明"}}`。所有 Worker API 响应均包含 `Cache-Control: no-store` 与 `X-Robots-Tag: noindex, nofollow`。无跨域开放配置，前台按同源方式调用。

| 请求 | 当前行为 |
| --- | --- |
| `GET /api/health` | 返回框架阶段、绑定是否存在，以及关闭的结算/后台状态 |
| `GET /api/catalog` | 读取已开放分类下的活跃真实商品；草稿、隐藏分类和没有活跃规格的商品不会公开 |
| `GET /api/products/:slug` | 返回一件活跃商品、活跃规格与图片对象引用 |
| `POST /api/checkout` | 固定返回 503 `CHECKOUT_NOT_CONFIGURED`；不解析请求体、不写订单、不触发支付 |
| `/api/admin`、`/api/admin/*` | 固定返回 503 `ADMIN_NOT_CONFIGURED`；包括带伪造认证头的请求 |
| `/api` 与其他 `/api/*` | 返回 JSON 404，不回退成状态 200 的首页 |

读取接口支持 `HEAD`。不支持的方法返回 405 和 `Allow`。生产支付回调尚未注册。

### 目录参数

| 参数 | 规则 |
| --- | --- |
| `category` | 英文小写字母、数字与连字符组成的分类 slug，最长 120 字符 |
| `q` | 最长 80 字符，搜索商品名或品牌；`%` 与 `_` 按普通文字处理 |
| `limit` | 默认 24，范围 1–48 |
| `offset` | 默认 0，范围 0–10000 |

目录返回 `products`、`categories` 和 `pagination: {limit, offset, hasMore}`。商品使用 `priceMinor`、`currency`、`currencyMinorUnit` 表示金额。例如 `2500 / JPY / 0` 表示 2,500 日元，不能统一除以 100。

`availableQuantity` 为活跃规格中**已建库存记录的可售量**（实存量减去预留量）的合计。缺少库存记录的规格按不可售处理：规格返回 `0`，不增加商品可售量。这个 `0` 不代表已经核实实体库存为零；调用方不能据此宣称“已核实零库存”。正式导入时，必须为每个活跃规格完整建立并核对库存记录。

图片返回 `imageKey` 或 `images[].objectKey`，需要后续媒体发布配置生成可访问地址。封面、替代文字及详情图片列表只包含商品级图片和活跃规格图片；草稿及已下架规格关联的图片不公开。

SQL 中的用户输入全部使用 D1 `prepare(...).bind(...)`，没有拼接用户输入进 SQL。用法参照 [D1 预处理语句文档](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)。数据库未迁移、连接失败或配额异常统一返回 503 `CATALOG_UNAVAILABLE`，响应不含 SQL、访问密钥或内部异常内容。

## 4. 数据结构

| 表 | 内容与约束 |
| --- | --- |
| `categories` | 分类层级、名称、排序与是否开放 |
| `products` | 商品文字、分类、上下架状态、币种、制造地与采购地 |
| `product_variants` | 唯一 SKU、规格属性、整数价格；币种必须与所属商品相同 |
| `product_images` | R2 对象键、替代文字、尺寸与排序；可关联同一商品的规格 |
| `inventory` | 按规格管理实存、预留、低库存阈值与修订号；不允许负库存或预留超过实存 |
| `orders` | 订单号、结算幂等键、金额、订单与支付状态；当前不包含姓名、电话或地址 |
| `order_items` | 成交时的商品名、规格、SKU、数量、单价和小计快照 |
| `payment_events` | 支付来源与事件 ID 复合唯一，保留验证时间及载荷摘要 |
| `settings` | JSON 形式的公开或内部设置；不存储支付密钥、管理密钥等秘密 |

制造地 `origin_country` 与采购地 `sourcing_country` 分开保存，均可为空；日本采购不会自动变成“日本制造”。金额使用整数最小货币单位，SQL 约束禁止小数价格、负数价格和不一致的明细小计。订单总价须等于商品小计加运费及税费再减优惠。订单行快照不会随商品改名而变化。

外键由 D1 默认强制校验；参照 [D1 外键文档](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)。此迁移没有触发器自动修改 `updated_at`，未来的写入代码需显式更新该字段。

这些约束属于数据基础，**尚不等同于完整交易实现**。启用真实结算前，还需服务端重新计算价格、库存预留与释放、原子扣减、订单状态校验、回调签名验证及幂等事务处理。不能仅依赖前台购物车总额或唯一索引完成付款。

## 5. 当前关闭的能力

- 后台目前仅展示信息架构，不使用前端隐藏按钮充当身份保护。将来需验证真正的管理员身份后再开放管理 API；不能直接信任 `CF-Access-Jwt-Assertion` 字符串存在。
- 结算接口不读取请求体，也不接收或记录用户填写的个人资料。当前没有发送邮件、上传文件、建单或扣款代码。
- 用量监控界面需显示“未接入”。本版没有 Cloudflare Analytics 采集器、提醒任务或实际的提前告警；不能显示虚构实时用量或声称提醒已启用。
- 产品接口为只读，未提供数据库浏览器、任意 SQL 或公开管理写入端点。

## 6. 验证方式与边界

在 Node.js 24 环境运行：

```sh
node --test tests/backend.test.mjs
```

测试用本地 SQLite 真实执行迁移和商品查询，D1 的 `prepare/bind/all/first` 仅做调用形状适配。检查包括：未配置时关闭交易、伪造管理认证头、请求体不被读取、草稿过滤、真实库存计算、SQL 参数绑定、错误不泄密、库存及币种约束、支付事件唯一、订单成交快照和总价约束。

本地 SQLite 测试不能代替远程 Cloudflare Workers/D1/R2 部署验证、真实管理员认证、真实支付或并发抢购验收。该阶段没有执行远程数据库迁移或产生费用。
