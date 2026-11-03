// 猛将OL游戏签到 - Cookie 自动抓取脚本（Loon http-request 类型）
//
// 配合插件里的 rewrite 规则使用：
// 当你用 Safari 打开登录页 https://user.td22.com 或签到页
// https://sb.td22.com/ac/20240920/index.aspx（Loon 开启中），
// 本脚本会把请求里的 Cookie 存到 $persistentStore，并弹窗提示。
// 多账号：每登录一个账号并打开一次页面，就会追加一条，互不覆盖。
// 列表最多保留 10 条；新 Cookie 追加到末尾；如果列表已满，删掉最旧的一条。

const KEY = "td22_accounts";
const MAX_ACCOUNTS = 10;

function notify(title, subtitle, message) {
  $notification.post(title, subtitle, message);
}

let cookie = $request.headers["Cookie"] || $request.headers["cookie"] || "";
if (!cookie) {
  notify("Cookie 抓取失败", "", "请求里没有 Cookie，先登录游戏账号再打开页面");
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
if (accounts.some((a) => a.cookie === cookie)) {
  notify("Cookie 已存在", "", "这个账号的 Cookie 已经存过了，共 " + accounts.length + " 个账号");
  $done({});
}

accounts.push({ name: "账号" + (accounts.length + 1), cookie: cookie });
while (accounts.length > MAX_ACCOUNTS) {
  accounts.shift();
}
// 重新编号，保持名字连续
accounts.forEach((a, i) => {
  a.name = "账号" + (i + 1);
});
$persistentStore.write(JSON.stringify(accounts), KEY);
notify("已抓取 Cookie", "", "成功保存第 " + accounts.length + " 个账号的 Cookie");
$done({});
