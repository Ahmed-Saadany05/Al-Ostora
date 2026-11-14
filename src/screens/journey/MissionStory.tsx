/**
 * A past mission, told by Refaey while you stand on its real terrain at the touchdown minute.
 * Refaey stands on the terrain with you: he introduces the landing, points at the Sun and at Earth (why that moment),
 * walks to two or three pieces of hardware while the camera follows, then one guess and the lesson. Everything is clickable.
 * The Sun and Earth are the recorded JPL Horizons positions (landingSky.json), not the app's live clock.
 */
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { lolaHorizon } from "@/data/horizons-lola";
import { SitePanorama, type SceneObject } from "@/scenes";
import { Guide3D, type Strip } from "@/scenes/moonview/Guide3D";
import type { CamView } from "@/scenes/moonview/MoonView3D";
import sprites from "@/screens/home/refaey/art/sprites.json";
import idleStrip from "@/screens/home/refaey/art/idle-strip.webp";
import walkStrip from "@/screens/home/refaey/art/walk-strip.webp";
import { useApp } from "@/shared/store/app";
import type { PanelContent } from "@/screens/home/refaey/DialogueText";
import type { Reply } from "@/screens/home/refaey/dialogues/dialogues";
import { useSites } from "@/shared/data";
import { formatDeg, formatUtc } from "@/shared/format";
import { missionUrl } from "@/shared/mission";
import { Button, Icon, LoadingState } from "@/shared/ui";
import { RefaeyTalk } from "./RefaeyTalk";
import { landingSkyState, placeFromSun } from "./landingSkyState";
import {
  landingOf,
  missionById,
  modelUrl,
  PAST_MISSIONS,
  type PastMission,
} from "./missions";
import s from "./journey.module.css";

/** Refaey's strips (Hady's art, cut from the sprite sheets): the same frames the 2D Refaey uses. Feet gaps measured on the art. */
const IDLE: Strip = { url: idleStrip, ...sprites.idle, feetGap: 5, fps: 6 };
const WALK: Strip = { url: walkStrip, ...sprites.walk, feetGap: 5, fps: 12 };

function fill(line: string, sunEl: number, earthEl: number) {
  return line
    .replace("{sun}", formatDeg(sunEl, 1, false))
    .replace("{earth}", formatDeg(earthEl, 1, false));
}

export function MissionStory() {
  const { id } = useParams();
  const mission = missionById(id);
  if (!mission) return <Navigate to="/missions" replace />;
  return <Story key={mission.id} mission={mission} />;
}

function Story({ mission }: { mission: PastMission }) {
  const navigate = useNavigate();
  const { data: sites } = useSites();
  const landing = landingOf(mission);
  const site = sites?.find((x) => x.id === landing.siteId);

  const horizon = useMemo(
    () => lolaHorizon(landing.siteId, landing.lat, landing.lon),
    [landing],
  );
  const sky = useMemo(
    () => landingSkyState(landing.siteId, landing, horizon),
    [landing, horizon],
  );
  const objects: SceneObject[] = useMemo(
    () =>
      mission.hardware.map((h) => ({
        id: h.id,
        url: modelUrl(h.model),
        label: h.label,
        yawDeg: h.yawDeg,
        rollDeg: h.rollDeg,
        ...placeFromSun(landing.sun.azDeg, h.fromSunDeg, h.distanceM),
      })),
    [mission, landing],
  );

  // ---- the tour: where Refaey stands and where the camera looks at each step
  const sunAz = landing.sun.azDeg;
  const front = sunAz + 80; // the hardware is laid out around this bearing (side-lit by the Sun)
  const steps = useMemo(() => {
    const pt = (azDeg: number, d: number) => ({
      x: d * Math.sin((azDeg * Math.PI) / 180),
      z: -d * Math.cos((azDeg * Math.PI) / 180),
    });
    const home = pt(front - 24, 8);
    const sunSpot = pt(sunAz + 16, 9);
    const earthLow = landing.earth.elDeg < 35;
    const earthSpot = earthLow ? pt(landing.earth.azDeg - 14, 9) : sunSpot;
    const out: {
      id: string;
      refaey: { x: number; z: number };
      view: CamView;
    }[] = [
      {
        id: "intro",
        refaey: home,
        view: { x: 0, z: 0, azDeg: front - 10, elDeg: -3, key: "intro" },
      },
      {
        id: "sun",
        refaey: sunSpot,
        view: {
          x: 0,
          z: 0,
          azDeg: sunAz + 7,
          elDeg: Math.max(1, landing.sun.elDeg * 0.6),
          key: "sun",
        },
      },
      {
        id: "earth",
        refaey: earthSpot,
        view: {
          x: 0,
          z: 0,
          azDeg: landing.earth.azDeg - (earthLow ? 6 : 0),
          elDeg: earthLow
            ? Math.max(1, landing.earth.elDeg * 0.6)
            : landing.earth.elDeg - 8,
          key: "earth",
        },
      },
    ];
    // Visit the chosen hardware in order of bearing, so a straight walk never crosses another model.
    const tour = mission.hardware
      .filter((h) => mission.tour.includes(h.id))
      .sort((p1, p2) => p1.fromSunDeg - p2.fromSunDeg);
    for (const h of tour) {
      const az = sunAz + h.fromSunDeg;
      const r = (az * Math.PI) / 180;
      const P = pt(az, h.distanceM);
      const u = { x: Math.sin(r), z: -Math.cos(r) }; // away from you
      const n = { x: Math.cos(r), z: Math.sin(r) }; // to the right
      const side = 1; // always on the right of it on screen: the balloon covers the left of the view
      const g = {
        x: P.x - u.x * 3 + n.x * side * 3.4,
        z: P.z - u.z * 3 + n.z * side * 3.4,
      };
      out.push({
        id: `item:${h.id}`,
        refaey: g,
        view: {
          x: P.x - u.x * 11 + n.x * side * 2.5,
          z: P.z - u.z * 11 + n.z * side * 2.5,
          at: { x: (P.x + g.x) / 2 - n.x * 2.2, z: (P.z + g.z) / 2 - n.z * 2.2, h: 1.1 },
          key: h.id,
        },
      });
    }
    out.push({
      id: "guess",
      refaey: home,
      view: { x: 0, z: 0, azDeg: front - 10, elDeg: -3, key: "guess" },
    });
    out.push({
      id: "lesson",
      refaey: home,
      view: { x: 0, z: 0, azDeg: front - 10, elDeg: -3, key: "lesson" },
    });
    return out;
  }, [mission, landing, sunAz, front]);
  const clearings = useMemo(
    () => [
      ...objects.map((o) => ({
        x: o.x,
        z: o.z,
        r: o.url.includes("lander") || o.url.includes("lm_") ? 6 : 3.5,
      })),
      ...steps.map((st) => ({ ...st.refaey, r: 1.6 })),
    ],
    [objects, steps],
  );

  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [picked, setPicked] = useState<string>();
  const [aim, setAim] = useState<{
    azDeg: number;
    elDeg: number;
    key: number;
  }>();
  const look = (b: "sun" | "earth") =>
    setAim({
      azDeg: landing[b].azDeg,
      elDeg: Math.max(-10, landing[b].elDeg),
      key: Date.now(),
    });
  const step = steps[i];
  const motion = useApp((st) => st.motion);

  const next =
    PAST_MISSIONS[(PAST_MISSIONS.indexOf(mission) + 1) % PAST_MISSIONS.length];
  const hw = mission.hardware.find((h) => h.id === picked);
  const q = mission.question;

  const talk: PanelContent = useMemo(() => {
    const go = (label: string, n: string): Reply => ({ label, next: n });
    const after = steps[i + 1]?.id ?? "";
    const afterHw = mission.hardware.find((h) => `item:${h.id}` === after);
    const nextLabel = afterHw
      ? `Walk me to the ${afterHw.label.replace(/ \(.*\)$/, "")}`
      : "Quick question for you";
    const fillLine = (l: string) =>
      fill(l, landing.sun.elDeg, landing.earth.elDeg);
    if (step.id === "intro")
      return {
        key: "intro",
        title: `${mission.name} · ${formatUtc(landing.time, false)}`,
        lines: [mission.arrive, mission.whyHere],
        replies: [go("Why land at that moment?", "next")],
      };
    if (step.id === "sun")
      return {
        key: "sun",
        title: "The Sun",
        lines: [fillLine(mission.sunLine)],
        replies: [go("And Earth?", "next")],
      };
    if (step.id === "earth")
      return {
        key: "earth",
        title: "Earth",
        lines: [fillLine(mission.earthLine)],
        replies: [go(nextLabel, "next")],
      };
    if (step.id.startsWith("item:")) {
      const h = mission.hardware.find((x) => `item:${x.id}` === step.id)!;
      return {
        key: step.id,
        title: h.label,
        lines: [h.fact],
        replies:
          after === "guess"
            ? [go("Quick question for you", "next")]
            : [go(nextLabel, "next"), go("Skip to the question", "guess")],
      };
    }
    if (step.id === "guess")
      return {
        key: "guess",
        title: "Your guess",
        lines: [q.ask],
        replies: q.options.map((o, k) => go(o.label, `answer:${k}`)),
      };
    const right = answer !== null && q.options[answer].correct;
    return {
      key: "lesson",
      title: right ? "Right" : "Not quite",
      lines: [right ? q.right : q.wrong, mission.lesson],
      replies: [
        go(`Next: ${next.name}`, "mission"),
        go("Plan a future mission", "plan"),
        go("All missions", "all"),
      ],
    };
  }, [step, steps, i, answer, mission, landing, q, next]);

  const onReply = (r: Reply) => {
    const n = r.next ?? "";
    if (n === "next") return setI((k) => Math.min(steps.length - 1, k + 1));
    if (n === "guess") return setI(steps.findIndex((st) => st.id === "guess"));
    if (n.startsWith("answer:")) {
      setAnswer(Number(n.slice(7)));
      return setI(steps.findIndex((st) => st.id === "lesson"));
    }
    if (n === "mission") return navigate(`/missions/${next.id}`);
    if (n === "plan") return navigate(missionUrl.chooseSite());
    if (n === "all") return navigate("/missions");
  };

  if (!site) return <LoadingState title="Landing…" />;

  return (
    <section className={s.stage}>
      <SitePanorama
        site={site}
        time={landing.time}
        fixedSky={sky}
        horizon={horizon}
        mode="stand"
        objects={objects}
        onObject={(oid) => setPicked((p) => (p === oid ? undefined : oid))}
        selectedObject={picked}
        initialYawDeg={front - 10}
        aim={aim}
        view={step.view}
        clearings={clearings}
        sceneExtras={(terrain) => (
          <Guide3D
            terrain={terrain}
            idle={IDLE}
            walk={WALK}
            from={steps[0].refaey}
            to={step.refaey}
            motion={motion}
          />
        )}
      />

      {/* Top-left: which landing, when, and the recorded sky. */}
      <div className={s.storyTitle}>
        <Button
          variant="secondary"
          leadingIcon="arrowLeft"
          icon={null}
          to="/missions"
        >
          All missions
        </Button>
        <p className={s.eyebrow}>
          {mission.agency} · {formatUtc(landing.time)}
        </p>
        <h1 className={s.storyName}>{mission.name}</h1>
        <div className={s.readouts}>
          <button
            type="button"
            className={s.readout}
            onClick={() => look("sun")}
          >
            <Icon name="sun" size={14} /> Sun {formatDeg(landing.sun.elDeg, 1)}
          </button>
          <button
            type="button"
            className={s.readout}
            onClick={() => look("earth")}
          >
            <Icon name="earth" size={14} /> Earth{" "}
            {formatDeg(landing.earth.elDeg, 1)}
            {landing.earth.elDeg < 0 && <small> below the horizon</small>}
          </button>
          <span className={s.recorded} title={landing.timeSource}>
            JPL Horizons · recorded at touchdown
          </span>
        </div>
      </div>

      {/* Hardware fact, when a label is clicked. */}
      {hw && (
        <aside className={s.factCard} aria-live="polite">
          <button
            type="button"
            className={s.factClose}
            onClick={() => setPicked(undefined)}
            aria-label="Close"
          >
            <Icon name="close" size={14} />
          </button>
          <p className={s.factTitle}>{hw.label}</p>
          <p className={s.factText}>{hw.fact}</p>
        </aside>
      )}

      {/* Refaey leads the story as a short conversation, bottom-left. */}
      <RefaeyTalk content={talk} onReply={onReply} figure={false} />
    </section>
  );
}
