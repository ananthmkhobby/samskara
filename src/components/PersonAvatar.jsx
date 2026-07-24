export const GEN_COLOR_STOPS = ["#5C1414", "#8A2222", "#7A5714", "#26381F", "#3D5A34"];

export function initialsOf(name) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function genColor(gen, minGen, maxGen) {
  if (maxGen === minGen) return GEN_COLOR_STOPS[0];
  const t = (gen - minGen) / (maxGen - minGen);
  return GEN_COLOR_STOPS[Math.round(t * (GEN_COLOR_STOPS.length - 1))];
}

export default function PersonAvatar({ person, photoUrl, size = 64, minGen = 1, maxGen = 5, variant = "solid", className }) {
  const url = photoUrl || person.photoUrl;
  const style = {
    width: size, height: size, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: Math.round(size * 0.36), flex: "none",
    overflow: "hidden"
  };
  // A quiet visual cue for a person who has passed — desaturated rather
  // than any starker treatment, so it reads as gentle rather than morbid.
  if (person.died) {
    style.filter = "grayscale(55%)";
    style.opacity = 0.86;
  }
  if (url) {
    style.border = variant === "band" ? "2px solid rgba(255,255,255,.5)" : "2px solid #fff";
    return (
      <div className={className} style={style}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  if (variant === "band") {
    style.background = "rgba(255,255,255,.18)";
    style.color = "#FBF0E8";
    style.border = "2px solid rgba(255,255,255,.5)";
  } else {
    style.background = genColor(person.gen, minGen, maxGen);
    style.color = "#fff";
  }
  return <div className={className} style={style}>{initialsOf(person.name)}</div>;
}
