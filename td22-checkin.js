// 猛将OL游戏每日签到 - Loon 单脚本版（抓 Cookie + 定时签到二合一）
//
// 跟 HostLoc 插件一样的写法：一个 js 干两件事。
// - http-request 触发（Safari 打开登录页/签到页）时：抓 Cookie 存起来
// - cron 定时触发（每天 9:05）时：用存好的 Cookie 逐个账号签到
//
// 判断方法：有 $request 就是 http-request，没 $request 就是 cron。

const KEY = "td22_accounts";
const MAX_ACCOUNTS = 10;
const SIGN_URL = "https://sb.td22.com/ac/20240920/IHttpHandle/comeback2.ashx?t=1&i=" + Math.random();

function notify(title, subtitle, body) {
  $notification.post(title, subtitle, body);
}

// ========== http-request：抓 Cookie ==========
if (typeof $request !== "undefined" && $request && $request.headers) {
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

  if (accounts.some((a) => a.cookie === cookie)) {
    notify("Cookie 已存在", "", "这个账号的 Cookie 已经存过了，共 " + accounts.length + " 个账号");
    $done({});
  }

  accounts.push({ name: "账号" + (accounts.length + 1), cookie: cookie });
  while (accounts.length > MAX_ACCOUNTS) {
    accounts.shift();
  }
  accounts.forEach((a, i) => {
    a.name = "账号" + (i + 1);
  });
  $persistentStore.write(JSON.stringify(accounts), KEY);
  notify("已抓取 Cookie", "", "成功保存第 " + accounts.length + " 个账号的 Cookie");
  $done({});
}

// ========== cron：定时签到 ==========
(function main() {
  let raw = $persistentStore.read(KEY);
  if (!raw) {
    notify("猛将OL签到", "没有已保存的账号", "先用 Safari 打开签到页并登录，Cookie 会自动抓取");
    return $done();
  }
  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch (e) {
    notify("猛将OL签到", "账号数据损坏", "请清空后重新登录抓取");
    return $done();
  }
  if (!accounts.length) {
    notify("猛将OL签到", "账号列表为空", "先用 Safari 打开签到页并登录");
    return $done();
  }

  let results = [];
  let idx = 0;

  function next() {
    if (idx >= accounts.length) {
      let okCount = results.filter((r) => r.ok).length;
      let lines = results.map((r) => (r.ok ? "✅ " : "❌ ") + r.name + "：" + r.msg);
      notify(
        "猛将OL签到完成 " + okCount + "/" + accounts.length,
        "",
        lines.join("\n")
      );
      return $done();
    }
    let acc = accounts[idx++];
    $httpClient.get(
      {
        url: SIGN_URL,
        headers: {
          Cookie: acc.cookie,
          Referer: "https://sb.td22.com/ac/20240920/index.aspx",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      },
      function (error, response, data) {
        if (error || !data) {
          results.push({ name: acc.name, ok: false, msg: "请求失败" });
          return next();
        }
        let m = data.match(/'msgID'\s*:\s*'(\d+)'/);
        let msgID = m ? m[1] : "?";
        if (msgID === "1") {
          let jf = (data.match(/'jifen'\s*:\s*'([^']*)'/) || [])[1] || "?";
          let prize = (data.match(/'name'\s*:\s*'([^']*)'/) || [])[1] || "";
          results.push({
            name: acc.name,
            ok: true,
            msg: "签到成功，积分 " + jf + (prize ? "，抽中 " + prize : ""),
          });
        } else if (msgID === "3") {
          results.push({ name: acc.name, ok: false, msg: "Cookie 已失效，请重新登录" });
        } else {
          let msg = (data.match(/'msg'\s*:\s*'([^']*)'/) || [])[1] || data.slice(0, 60);
          let already = /已签|已经|重复/.test(msg);
          results.push({ name: acc.name, ok: already, msg: msg });
        }
        next();
      }
    );
  }
  next();
})();
