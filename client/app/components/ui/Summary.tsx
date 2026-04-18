interface SummaryProps {
  time?: string;
  status?: string;
  image?: string;
  label?: string;
  showReflection?: boolean;
}

const imgVector =
  "https://www.figma.com/api/mcp/asset/ffb45169-31ac-4c37-9ce5-ef097f9a568b";
const imgAiIcon =
  "https://www.figma.com/api/mcp/asset/5d84c1c8-34a4-4fed-aea5-f5a5693c8a83";

export default function Summary({
  time = "00:00:00 CST",
  status = "Everything normal",
  image = "/rover.png",
  label = "Pressurized Rover",
  showReflection = true,
}: SummaryProps) {
  return (
    <div
      style={{
        background: "#3a3a41",
        borderRadius: 12,
        padding: 20,
        width: 314,
        height: 384,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Images positioned absolutely */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 83,
          width: 227,
          height: 188,
        }}
      >
        <img
          src={image}
          alt="Rover"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: 12,
            boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.15)",
          }}
        />
      </div>
      {showReflection && (
        <div
          style={{
            position: "absolute",
            left: 23.79,
            top: 83 + 18.73,
            width: 219.547,
            height: 153.149,
            transform: "scaleY(-1)",
          }}
        >
          <img
            src={imgVector}
            alt=""
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      )}

      {/* Text content */}
      <div
        style={{
          position: "relative",
          width: 274,
          height: 338,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <p
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 16,
            fontWeight: 400,
            color: "#c5c9d2",
            letterSpacing: "0.64px",
            margin: 0,
          }}
        >
          {time}
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: 1,
            }}
          >
            <p
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 18,
                fontWeight: 400,
                color: "#f1f2f5",
                letterSpacing: "0.18px",
                margin: 0,
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 16,
                fontWeight: 400,
                color: "#c5c9d2",
                letterSpacing: "0.64px",
                margin: 0,
              }}
            >
              {status}
            </p>
          </div>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            <img
              src={imgAiIcon}
              alt="AI"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
