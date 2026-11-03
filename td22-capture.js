// td22 游戏签到 - Cookie 自动抓取脚本（Loon http-request 类型）
//
// 配合 td22-signin.conf 里的 rewrite 规则使用：
// 当你用 Safari 打开签到页 https://sb.td22.com/ac/20240920/index.aspx
// （Loon 开启中），本脚本会把请求里的 Cookie 存到 $persistentStore。
// 多账号：每登录一个账号并打开一次签到页，就会追加一条，互不覆盖。
// Cookie 失效后重新登录一次，旧的失效条目会被新 Cookie 替换（按账号名去重
// 做不到，因为 Cookie 里看不出账号名；所以策略是：相同 Cookie 去重，
// 失效条目由定时脚本报出后，你手动清理或等下次抓取时自动顶掉最旧的）。
//
// 简化策略：列表最多保留 10 条；新 Cookie 追加到末尾；
// 如果列表已满，删掉最旧的一条。定时脚本会逐个尝试并报告哪些失效，
// 失效的请在 Loon 持久化里手动删掉对应条目。

const KEY = "td22_accounts";
const MAX_ACCOUNTS = 10;

let cookie = $request.headers["Cookie"] || $request.headers["cookie"] || "";
if (!cookie) {
  $done({});
}

let raw = $persistentStore.read(KEY);
let accounts = [];
try {
  accounts = raw ? JSON.parse(raw) : [];
} catch (e) {
  accounts = [];
}

// 相同 Cookie 已存在就不重复存
if (!accounts.some((a) => a.cookie === cookie)) {
  accounts.push({ name: "账号" + (accounts.length + 1), cookie: cookie });
  while (accounts.length > MAX_ACCOUNTS) {
    accounts.shift();
  }
  // 重新编号，保持名字连续
  accounts.forEach((a, i) => {
    a.name = "账号" + (i + 1);
  });
  $persistentStore.write(JSON.stringify(accounts), KEY);
}

$done({});
