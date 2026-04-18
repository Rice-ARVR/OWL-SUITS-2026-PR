interface FanStatus {
  label: string;
  rpm: number;
  direction?: "up" | "down";
}

interface FansProps {
  mode?: string;
  caption?: string;
  fans?: FanStatus[];
}

const imgEllipse2 =
  "https://www.figma.com/api/mcp/asset/326bf7fd-f943-4e0b-b93b-609d3737f912";
const imgVector =
  "https://www.figma.com/api/mcp/asset/71769b0d-b893-43bf-823f-447f52d34e0a";
const imgVector1 =
  "https://www.figma.com/api/mcp/asset/f0b68e6a-6405-45a6-8682-dcb469331511";

const FanArrowIcon = ({ direction = "up" }: { direction?: "up" | "down" }) => (
  <div
    style={{
      width: 20,
      height: 20,
      background: "#3a3a41",
      borderRadius: 4,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <img
      src={imgVector1}
      alt={direction === "up" ? "Up arrow" : "Down arrow"}
      style={{ width: 10, height: 10 }}
    />
  </div>
);

export default function Fans({
  mode = "Normal",
  caption = "fan operation",
  fans = [
    { label: "Fan 1", rpm: 3000, direction: "up" },
    { label: "Fan 2", rpm: 3000, direction: "up" },
  ],
}: FansProps) {
  return (
    <div
      style={{
        background: "#2e2e32",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 5,
          background: "#3b3a41",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 38,
            width: 30,
            height: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "scaleY(-1)",
          }}
        >
          <img
            src={imgEllipse2}
            alt="Icon glow"
            style={{ width: 30, height: 4, display: "block" }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6.26,
            width: 34,
            height: 34,
          }}
        >
          <img
            src={imgVector}
            alt="Fan icon"
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 9,
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 16,
            fontWeight: 400,
            lineHeight: "100%",
            color: "#c5c9d2",
            letterSpacing: "0.64px",
            margin: 0,
          }}
        >
          <span style={{ color: "#9de4ce" }}>{mode}</span>
          <span>{` ${caption}`}</span>
        </p>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {fans.map((fan) => (
            <div
              key={fan.label}
              style={{ display: "flex", flexDirection: "column", gap: 0 }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: '"Be Vietnam Pro", sans-serif',
                  fontSize: 18,
                  fontWeight: 400,
                  lineHeight: "100%",
                  color: "#a1a4af",
                  letterSpacing: "0.18px",
                  whiteSpace: "nowrap",
                }}
              >
                {fan.label}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 47,
                  marginTop: 3,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontSize: 18,
                    fontWeight: 400,
                    lineHeight: "100%",
                    color: "#c5c9d2",
                    letterSpacing: "0.18px",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{`${fan.rpm} `}</span>
                  <span style={{ fontSize: 16, letterSpacing: "0.64px" }}>
                    rpm
                  </span>
                </p>
                <FanArrowIcon direction={fan.direction} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}