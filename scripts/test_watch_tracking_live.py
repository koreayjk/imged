"""가짜 YouTube 플레이어를 주입해 Lesson 화면의 시청 추적을 실제 코드 경로로 검증."""
import json
from playwright.sync_api import sync_playwright
CH="/opt/pw-browsers/chromium"; BASE="http://localhost:4174"
prof={"name":"Moses","role":"student","nativeLang":"ko","duration":"6m","style":"focus",
      "levelMath":"basic","levelEnglish":"basic","startedAt":"2026-08-24"}

# window.YT를 미리 심어두면 loadYouTubeApi()가 네트워크를 타지 않고 이걸 쓴다.
FAKE_YT = """
window.__sim = { pos: 0, dur: 249, listeners: null, target: null };
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: function (el, opts) {
    const self = this;
    window.__sim.dur = window.__sim.dur;
    self.getCurrentTime = () => window.__sim.pos;
    self.getDuration = () => window.__sim.dur;
    self.destroy = () => {};
    window.__sim.target = self;
    window.__sim.listeners = opts.events;
    setTimeout(() => opts.events.onReady && opts.events.onReady({ target: self }), 0);
    return self;
  },
};
// 테스트에서 부를 헬퍼: 재생 시작 → 위치 이동 → 정지/종료
window.__play = () => window.__sim.listeners.onStateChange({ data: 1 });
window.__pause = () => window.__sim.listeners.onStateChange({ data: 2 });
window.__end = () => { window.__sim.pos = window.__sim.dur;
                       window.__sim.listeners.onStateChange({ data: 0 }); };
window.__seek = (t) => { window.__sim.pos = t; };
"""

def state(vp=None):
    return {"profile":prof,"videoProgress":vp or {},
            "dayStates":{"0":{"doneBlocks":[],"finished":False}},
            "currentDayIndex":0,"attempts":[],"attendance":{}}

def prog(p):
    d=p.evaluate("JSON.parse(localStorage.getItem('ged-app-v1')).videoProgress")
    return next(iter(d.values())) if d else None

def sim_watch(p, frm, to, speed=1.0):
    """재생 위치를 실시간으로 이동시키며 앱의 0.5초 샘플러가 기록하게 한다."""
    p.evaluate("window.__seek(%f); window.__play();" % frm)
    p.evaluate("""([frm,to,speed]) => new Promise(res => {
        window.__sim.pos = frm;
        const t = setInterval(() => {
          window.__sim.pos += 1.0 * speed;
          if (window.__sim.pos >= to) { window.__sim.pos = to; clearInterval(t); res(); }
        }, 100);
    })""", [frm, to, speed])
    p.wait_for_timeout(900)   # 샘플러가 마지막 위치를 반영할 시간
    p.evaluate("window.__pause();")
    p.wait_for_timeout(300)

fails=[]
def check(name, cond, extra=""):
    print(("  ✓ " if cond else "  ✗ ")+name+("" if cond else f"  {extra}"))
    if not cond: fails.append(name)

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CH)

    print("\n[A] 나눠 보기 — 사용자가 겪은 그 상황")
    c=b.new_context(viewport={"width":1280,"height":900})
    c.add_init_script(FAKE_YT)
    c.add_init_script("if(!localStorage.getItem('ged-app-v1'))localStorage.setItem('ged-app-v1', %s)"%json.dumps(json.dumps(state())))
    p=c.new_page(); p.goto(BASE+"/lesson/0/1/0", wait_until="domcontentloaded"); p.wait_for_timeout(1500)
    sim_watch(p, 0, 169)                       # 1회차 ~68%
    a=prog(p); print("    1회차:", a["watchedSeconds"], "초")
    check("1회차 약 68%", 60 <= a["watchedSeconds"]/249*100 <= 75, f'{a["watchedSeconds"]}')
    p.goto(BASE+"/today", wait_until="domcontentloaded"); p.wait_for_timeout(600)
    p.goto(BASE+"/lesson/0/1/0", wait_until="domcontentloaded"); p.wait_for_timeout(1500)
    sim_watch(p, 169, 249)                     # 2회차 나머지
    bb=prog(p); print("    2회차:", bb["watchedSeconds"], "초 / 완료", bb["completed"])
    check("2회차에 진도가 이어져 완료됨", bb["completed"] is True, json.dumps(bb))
    c.close()

    print("\n[B] 끝까지 재생하면 비율과 무관하게 완료")
    c=b.new_context(viewport={"width":1280,"height":900})
    c.add_init_script(FAKE_YT)
    c.add_init_script("if(!localStorage.getItem('ged-app-v1'))localStorage.setItem('ged-app-v1', %s)"%json.dumps(json.dumps(state())))
    p=c.new_page(); p.goto(BASE+"/lesson/0/1/0", wait_until="domcontentloaded"); p.wait_for_timeout(1500)
    sim_watch(p, 0, 100)
    p.evaluate("window.__end();"); p.wait_for_timeout(500)
    e=prog(p); print("    ", json.dumps(e))
    check("ENDED → 완료 처리", e["completed"] is True, json.dumps(e))
    c.close()

    print("\n[C] 끝으로 건너뛰면 완료되지 않음")
    c=b.new_context(viewport={"width":1280,"height":900})
    c.add_init_script(FAKE_YT)
    c.add_init_script("if(!localStorage.getItem('ged-app-v1'))localStorage.setItem('ged-app-v1', %s)"%json.dumps(json.dumps(state())))
    p=c.new_page(); p.goto(BASE+"/lesson/0/1/0", wait_until="domcontentloaded"); p.wait_for_timeout(1500)
    sim_watch(p, 0, 10)
    p.evaluate("window.__seek(240); window.__play();"); p.wait_for_timeout(900)
    p.evaluate("window.__pause();"); p.wait_for_timeout(300)
    s=prog(p); print("    ", json.dumps(s))
    check("스킵은 완료로 인정되지 않음", not s["completed"], json.dumps(s))
    c.close()

    print("\n[D] 기존 사용자(구 형식 데이터)가 이어보기")
    c=b.new_context(viewport={"width":1280,"height":900})
    c.add_init_script(FAKE_YT)
    legacy={"KcKOM7Degu0":{"watchedSeconds":169,"completed":False}}
    c.add_init_script("if(!localStorage.getItem('ged-app-v1'))localStorage.setItem('ged-app-v1', %s)"%json.dumps(json.dumps(state(legacy))))
    p=c.new_page(); p.goto(BASE+"/lesson/0/1/0", wait_until="domcontentloaded"); p.wait_for_timeout(1500)
    sim_watch(p, 169, 249)
    d=prog(p); print("    ", json.dumps(d))
    check("구 데이터도 이어져 완료", d["completed"] is True, json.dumps(d))
    c.close()
    b.close()

print(f"\n{'전부 통과' if not fails else '실패: '+', '.join(fails)}")
