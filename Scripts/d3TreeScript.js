// Function resulting from: https://observablehq.com/@d3/tree
// Copyright 2021 Observable, Inc.
// Released under the ISC license.

export function Tree(data, {        // "data" is hierarchy (nested objects)
    children,                       // Given a d in data, returns its children
    tree = d3.tree,                 // Layout algorithm (typically d3.tree or d3.cluster)
    label,                          // Given a node d, returns the display name
    title,                          // Given a node d, returns its hover text
    width = 640,                    // Outer width, in pixels
    height,                         // Outer height, in pixels
    r = 3,                          // Radius of nodes
    padding = 1,                    // Horizontal padding for first and last column
    nodeNormClass = "",             // Class for nodes with children
    nodeLeafClass = "",             // Class for nodes without children
    strokeColor = "#555",           // Stroke color for links
    strokeWidth = 1.5,              // Stroke width for links
    strokeOpacity = 0.4,            // Stroke opacity for links
    strokeLinejoin,                 // Stroke line join for links
    strokeLinecap,                  // Stroke line cap for links
    halo = "#fff",                  // Color of label halo
    haloWidth = 3,                  // Padding around the labels
    curve = d3.curveBumpX,          // Curve for the link
} = {}) {

    // We assume that the data is specified as an object {children} with nested objects
    // (a.k.a. the “flare.json” format), and use d3.hierarchy
    const root = d3.hierarchy(data, children);

    // Compute labels and titles
    const descendants = root.descendants();
    const L = label == null ? null : descendants.map(d => label(d.data, d));

    // Compute the layout
    const dx = 12;
    const dy = width / (root.height + padding);
    tree().nodeSize([dx, dy])(root);

    // Computing heights
    let x0 = Infinity, x1 = -x0;
    root.each(d => {                                        // Getting max and min heights
        if (d.x > x1) x1 = d.x;
        if (d.x < x0) x0 = d.x;
    }).each(d => {                                          // Adding pads
        d.x -= x0;                                          // Highest x (negative), moving the upmost x to 0
        d.y += dy * padding / 2 -10;                        //Little space to the left
    });
    if (height === undefined) height = x1 - x0 + dx * 2;    // Default height

    // Use the required curve
    if (typeof curve !== "function") throw new Error(`Unsupported curve`);

    // --- Main SVG box ---
    const svg = d3.create("svg")
        .attr("viewBox", [0, -dx, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10);

    // --- Adding legend ---
    addLegend(svg, halo, haloWidth)

    // --- Curved strokes of tree ---
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke", strokeColor)
        .attr("stroke-opacity", strokeOpacity)
        .attr("stroke-linecap", strokeLinecap)
        .attr("stroke-linejoin", strokeLinejoin)
        .attr("stroke-width", strokeWidth)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d3.link(curve)
            .x(d => d.y)
            .y(d => d.x));

    // --- Adding tree nodes ---
    // Tree nodes data
    const node = svg.append("g")
        .selectAll("a")
        .data(root.descendants())
        .join("a")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // OnClick event: display node infos
    node.on("click", function(event) {
       nodeShowInfo(event, this);
    })

    // Node icons
    node.append("circle")
        .attr("class", d => d.children ? nodeNormClass : nodeLeafClass)
        .attr("r", r);

    // Hover text
    if (title != null) node.append("title")
        .text(d => title(d.data, d));

    // Node labels
    if (L) node.append("text")
        .attr("dy", "0.32em")
        .attr("x", d => d.children ? -7 : 7)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth)
        .text((d, i) => L[i]);

    return svg.node();
}

function nodeShowInfo(event, node) {
    // Remove id "activeNode" from the last active node, if any
    const lastActive = document.getElementById("activeNode");
    if (lastActive) {lastActive.removeAttribute("id");}

    // Add id "activeNode" at the current node
    const circleElement = node.querySelector("circle");
    circleElement.setAttribute("id", "activeNode");

    // Search the text nodes
    const infoBoxName = document.getElementById("infoTextName");
    const infoBoxSynonyms = document.getElementById("infoTextSynonyms");
    const infoBoxVerbs = document.getElementById("infoTextVerbs");

    // Infos in the node
    const data = node.__data__.data;

    // Overwrite text in the text nodes
    let oldStrName = infoBoxName.innerHTML.split(/(?<=: )/)[0];
    infoBoxName.innerHTML = oldStrName + data.Name;

    let oldStrSyn = infoBoxSynonyms.innerHTML.split(/(?<=: )/)[0];
    let textSyn = "";
    if (!(data.Synonyms.length === 0)) {
        let strSyn = data.Synonyms.toString()
            .replaceAll(",", ", ");
        textSyn += strSyn;
    } else {
        textSyn += "None";
    }
    infoBoxSynonyms.innerHTML = oldStrSyn + textSyn;

    let oldStrVer = infoBoxVerbs.innerHTML.split(/(?<=: )/)[0];
    let textVerbs = "";
    if (!(data.Verbs.length === 0)) {
        let strVer = data.Verbs.toString()
            .replaceAll(",", ", ");
        textVerbs += strVer;
    } else {
        textVerbs += "None";
    }
    infoBoxVerbs.innerHTML = oldStrVer + textVerbs;
}

// Add a graphical legend in the top left corner
function addLegend(svg, halo, haloWidth) {
    // Legend parameters
    const legendKeys = [
        {name: "Node", id: "nodeNormLeg"},
        {name: "Leaf", id: "nodeLeafLeg"},
        {name: "Active", id: "activeNodeLeg"}
    ];
    let legendRadius = 6;
    let legendSpacing = 5;

    // Legend container
    const legend = svg.append("g")
        .selectAll(".legendItem")
        .data(legendKeys);

    // Legend icons
    legend.enter()
        .append("circle")
        .attr("cx", legendRadius + 1)
        .attr("cy", legendRadius + 1)
        .attr("r", legendRadius)
        .attr("id", d => d.id)
        .attr("transform",
            (d, i) => {
                let y = ((legendRadius * 2) + legendSpacing) * i;
                return `translate(0, ${y})`;
            })

    // Legend texts
    legend.enter()
        .append("text")
        .attr("x", (legendRadius * 2) + legendSpacing)      // Diameter + padding between icon and text
        .attr("y", (d, i) =>
            ((legendRadius * 2) + legendSpacing) * i + 11)  // 11 is a fixed value for centering the text
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth)
        .text(d => d.name)
}