import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #090d16 100%)",
          borderRadius: "7px",
          border: "1.5px solid rgba(129, 140, 248, 0.6)",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            fontFamily: "sans-serif",
            color: "#38bdf8",
            display: "flex",
            lineHeight: 1,
            marginTop: "-1px",
          }}
        >
          K
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
