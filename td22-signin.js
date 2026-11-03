// td22 游戏每日签到 - Loon 定时脚本（多账号，可自定义时间）
//
// 原理：签到接口 GET /ac/20240920/IHttpHandle/comeback2.ashx?t=1
// 只需要登录态 Cookie，不需要验证码。Cookie 由配套的 td22-capture.js
// 在你平时用 Safari 打开签到页时自动抓取并存到 $persistentStore。
//
// 时间设置：在 Loon 插件设置里改签到时间，格式 HH:MM，默认 9:05。
// 插件的 cron 每小时跑一次，脚本只在设定的那个小时内真正签到，
// 其他小时静默退出，不发通知。
//
// 账号列表存在 $persistentStore 的 td22_accounts 里，格式：
//   [{"name":"账号1","cookie":"ASP.NET_SessionId=xxx; ..."}, ...]
// 由 td22-capture.js 自动维护，不用手动填。
// 想删某个过期账号：在 Loon -> 脚本 -> 本脚本的"持久化"里编辑即可，
// 或直接清空 td22_accounts 后重新登录各账号抓取。

const KEY = "td22_accounts";
const URL = "https://sb.td22.com/ac/20240920/IHttpHandle/comeback2.ashx?t=1&i=" + Math.random();

function notify(title, subtitle, body) {
  $notification.post(title, subtitle, body);
}

function done() {
  $done();
}

function main() {
  // 解析插件设置里的时间，默认 9:05
  // 插件里 #!arguments=签到时间:9:05，用户在插件设置里改了时间后，
  // Loon 会把新值传给脚本。$argument 可能是 "9:05"、"签到时间=9:05"、
  // "签到时间:9:05" 或 "time=9:05" 等格式，这里都兼容。
  let targetHour = 9;
  let targetMin = 5;
  try {
    let arg = "";
    if (typeof $argument === "string") {
      arg = $argument;
    } else if ($argument && typeof $argument === "object") {
      arg = $argument["签到时间"] || $argument["time"] || $argument["签到时间 "] || "";
    }
    let m = String(arg).match(/(\d{1,2}):(\d{1,2})/);
    if (m) {
      targetHour = parseInt(m[1], 10);
      targetMin = parseInt(m[2], 10);
    }
  } catch (e) {}

  // 只在目标小时内签到，其他小时静默退出
  let now = new Date();
  if (now.getHours() !== targetHour) {
    return done();
  }

  let raw = $persistentStore.read(KEY);
  if (!raw) {
    notify("猛将OL签到", "没有已保存的账号", "先用 Safari 打开签到页并登录，Cookie 会自动抓取");
    return done();
  }
  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch (e) {
    notify("猛将OL签到", "账号数据损坏", "请清空后重新登录抓取");
    return done();
  }
  if (!accounts.length) {
    notify("猛将OL签到", "账号列表为空", "先用 Safari 打开签到页并登录");
    return done();
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
      return done();
    }
    let acc = accounts[idx++];
    $httpClient.get(
      {
        url: URL,
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
        // 返回是单引号字面量风格：[{'msgID':'1','jifen':'5','name':'...'}]
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
          // 已签到也算成功（服务器每天只允许一次，重复调用会被挡）
          let already = /已签|已经|重复/.test(msg);
          results.push({ name: acc.name, ok: already, msg: msg });
        }
        next();
      }
    );
  }
  next();
}

main();
