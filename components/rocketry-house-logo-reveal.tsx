"use client";

import { type CSSProperties } from "react";

type RocketryHouseLogoRevealProps = {
  className?: string;
  mode?: "animated" | "loop" | "static";
  style?: CSSProperties;
};

const LOGO_WIDTH = 971;
const LOGO_HEIGHT = 211;
const LOOP_DURATION_MS = 4200;
const ASSET_ROOT = "/logo-reveal";

type LogoLayer = {
  alt?: string;
  className: string;
  file: string;
  h: number;
  w: number;
  x: number;
  y: number;
};

const layers = {
  nozzle: { className: "rh-source-logo__nozzle", file: "nozzle.png", x: 4, y: 2, w: 158, h: 207 },
  wordmark: { className: "rh-source-logo__wordmark", file: "wordmark.png", x: 312, y: 57, w: 655, h: 102 },
  diamondOne: { className: "rh-source-logo__diamond rh-source-logo__diamond--one", file: "diamond-1.png", x: 42, y: 70, w: 69, h: 67 },
  diamondTwo: { className: "rh-source-logo__diamond rh-source-logo__diamond--two", file: "diamond-2.png", x: 115, y: 80, w: 47, h: 47 },
  diamondThree: { className: "rh-source-logo__diamond rh-source-logo__diamond--three", file: "diamond-3.png", x: 177, y: 87, w: 34, h: 34 },
  diamondFour: { className: "rh-source-logo__diamond rh-source-logo__diamond--four", file: "diamond-4.png", x: 228, y: 91, w: 27, h: 27 },
  periodProxy: { className: "rh-source-logo__period-proxy", file: "diamond-4.png", x: 228, y: 91, w: 27, h: 27 },
  period: { className: "rh-source-logo__period", file: "period.png", x: 678, y: 115, w: 20, h: 21 }
} satisfies Record<string, LogoLayer>;

function layerStyle(layer: LogoLayer): CSSProperties {
  return {
    height: `${(layer.h / LOGO_HEIGHT) * 100}%`,
    left: `${(layer.x / LOGO_WIDTH) * 100}%`,
    top: `${(layer.y / LOGO_HEIGHT) * 100}%`,
    width: `${(layer.w / LOGO_WIDTH) * 100}%`
  };
}

function LogoLayerImage({ layer }: { layer: LogoLayer }) {
  return (
    <img
      aria-hidden="true"
      className={`rh-source-logo__layer ${layer.className}`}
      draggable={false}
      src={`${ASSET_ROOT}/${layer.file}`}
      style={layerStyle(layer)}
      alt=""
    />
  );
}

export function RocketryHouseLogoReveal({
  className,
  mode = "animated",
  style
}: RocketryHouseLogoRevealProps) {
  const rootClassName = ["rh-source-logo", className].filter(Boolean).join(" ");
  const animated = mode !== "static";

  return (
    <figure className={rootClassName} data-mode={mode} style={style} aria-hidden="true">
      <div className="rh-source-logo__stage">
        {animated ? (
          <>
            <LogoLayerImage layer={layers.nozzle} />
            <LogoLayerImage layer={layers.diamondOne} />
            <LogoLayerImage layer={layers.diamondTwo} />
            <LogoLayerImage layer={layers.diamondThree} />
            <LogoLayerImage layer={layers.diamondFour} />
            <LogoLayerImage layer={layers.periodProxy} />
            <LogoLayerImage layer={layers.period} />
            <LogoLayerImage layer={layers.wordmark} />
          </>
        ) : null}
        <img
          className="rh-source-logo__final"
          draggable={false}
          src={`${ASSET_ROOT}/final-logo.png`}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          alt=""
        />
      </div>

      <style>{`
        .rh-source-logo {
          display: block;
          width: min(100%, ${LOGO_WIDTH}px);
          margin: 0;
        }

        .rh-source-logo__stage {
          position: relative;
          width: 100%;
          aspect-ratio: ${LOGO_WIDTH} / ${LOGO_HEIGHT};
          overflow: hidden;
          background: transparent;
          transform-origin: 50% 50%;
        }

        .rh-source-logo__layer,
        .rh-source-logo__final {
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        .rh-source-logo__layer {
          position: absolute;
          object-fit: contain;
          opacity: 0;
          will-change: opacity, transform, clip-path;
        }

        .rh-source-logo__final {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 1;
        }

        .rh-source-logo[data-mode="animated"] .rh-source-logo__stage,
        .rh-source-logo[data-mode="loop"] .rh-source-logo__stage {
          animation: rh-source-logo-finish ${LOOP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .rh-source-logo[data-mode="animated"] .rh-source-logo__final,
        .rh-source-logo[data-mode="loop"] .rh-source-logo__final {
          opacity: 0;
          animation: rh-source-logo-final-frame ${LOOP_DURATION_MS}ms linear both;
        }

        .rh-source-logo[data-mode="loop"] .rh-source-logo__stage,
        .rh-source-logo[data-mode="loop"] .rh-source-logo__final,
        .rh-source-logo[data-mode="loop"] .rh-source-logo__layer {
          animation-iteration-count: infinite;
        }

        .rh-source-logo__diamond--one {
          animation: rh-source-logo-diamond-one ${LOOP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .rh-source-logo__diamond--two {
          animation: rh-source-logo-diamond-pop ${LOOP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .rh-source-logo__diamond--three {
          animation: rh-source-logo-diamond-pop-three ${LOOP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .rh-source-logo__diamond--four {
          animation: rh-source-logo-diamond-pop-four ${LOOP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .rh-source-logo__nozzle {
          clip-path: inset(0 100% 0 0);
          animation: rh-source-logo-mask-reveal ${LOOP_DURATION_MS}ms cubic-bezier(0.55, 0, 0.1, 1) both;
        }

        .rh-source-logo__wordmark {
          clip-path: inset(0 50% 0 50%);
          animation: rh-source-logo-wordmark-reveal ${LOOP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .rh-source-logo__period-proxy {
          opacity: 0;
          animation: rh-source-logo-period-proxy ${LOOP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .rh-source-logo__period {
          opacity: 0;
          animation: rh-source-logo-period ${LOOP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes rh-source-logo-diamond-one {
          0% {
            opacity: 1;
            transform: scale(0.04);
          }
          7.143% {
            opacity: 1;
            transform: scale(1.05);
          }
          10.476%, 49.238% {
            opacity: 1;
            transform: scale(1);
          }
          52.381%, 100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes rh-source-logo-diamond-pop {
          0%, 5.238% {
            opacity: 0;
            transform: scale(0.35);
          }
          10.476% {
            opacity: 1;
            transform: scale(1.05);
          }
          14.667%, 49.238% {
            opacity: 1;
            transform: scale(1);
          }
          52.381%, 100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes rh-source-logo-diamond-pop-three {
          0%, 8.119% {
            opacity: 0;
            transform: scale(0.35);
          }
          13.357% {
            opacity: 1;
            transform: scale(1.05);
          }
          17.548%, 49.238% {
            opacity: 1;
            transform: scale(1);
          }
          52.381%, 100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes rh-source-logo-diamond-pop-four {
          0%, 11% {
            opacity: 0;
            transform: scale(0.35);
          }
          16.238% {
            opacity: 1;
            transform: scale(1.05);
          }
          20.429%, 49.238% {
            opacity: 1;
            transform: scale(1);
          }
          52.381%, 100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes rh-source-logo-mask-reveal {
          0%, 14.667% {
            opacity: 1;
            clip-path: inset(0 100% 0 0);
          }
          29.333%, 49.238% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
          52.381%, 100% {
            opacity: 0;
            clip-path: inset(0 0 0 0);
          }
        }

        @keyframes rh-source-logo-wordmark-reveal {
          0%, 30.381% {
            opacity: 1;
            clip-path: inset(0 50% 0 50%);
          }
          42.952%, 49.238% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
          52.381%, 100% {
            opacity: 0;
            clip-path: inset(0 0 0 0);
          }
        }

        @keyframes rh-source-logo-period-proxy {
          0%, 30.381% {
            opacity: 0;
            transform: translate(0, 0) scale(0.35);
          }
          34.571% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          42.952% {
            opacity: 1;
            transform: translate(1666.667%, 88.889%) scale(0.78);
          }
          47.143% {
            opacity: 0;
            transform: translate(1666.667%, 88.889%) scale(0.62);
          }
          52.381%, 100% {
            opacity: 0;
            transform: translate(1666.667%, 88.889%) scale(0.62);
          }
        }

        @keyframes rh-source-logo-period {
          0%, 42.952% {
            opacity: 0;
            transform: scale(0.55);
          }
          47.143%, 49.238% {
            opacity: 1;
            transform: scale(1);
          }
          52.381%, 100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes rh-source-logo-final-frame {
          0%, 48.714% {
            opacity: 0;
          }
          50.81%, 100% {
            opacity: 1;
          }
        }

        @keyframes rh-source-logo-finish {
          0%, 44% {
            transform: scale(1);
          }
          48.19% {
            transform: scale(1.02);
          }
          52.381%, 100% {
            transform: scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rh-source-logo__stage,
          .rh-source-logo__final,
          .rh-source-logo__layer {
            animation: none !important;
          }

          .rh-source-logo__stage {
            transform: scale(1);
          }

          .rh-source-logo__layer {
            opacity: 0;
          }

          .rh-source-logo__final {
            opacity: 1 !important;
          }
        }
      `}</style>
    </figure>
  );
}
