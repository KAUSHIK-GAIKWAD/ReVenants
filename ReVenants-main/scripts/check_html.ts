async function fetchHtml() {
  const res = await fetch("http://localhost:8080/");
  const text = await res.text();
  console.log("Length:", text.length);
  // find all occurrences of revenants_coord_bot
  const matches = text.match(/revenants_coord_bot[^\s"']*/g);
  console.log("Matches:", matches);
}

fetchHtml();
