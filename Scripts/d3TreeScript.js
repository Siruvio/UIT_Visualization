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
    nodeColor = "#999",             // Color for nodes with children
    leafColor = "#999",             // Color for nodes without children
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
    const dx = 10;
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
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10);

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

    // Node icons
    node.append("circle")
        .attr("fill", d => d.children ? nodeColor : leafColor)
        .attr("r", r);

    // Hover text
    if (title != null) node.append("title")
        .text(d => title(d.data, d));

    // Node labels
    if (L) node.append("text")
        .attr("dy", "0.32em")
        .attr("x", d => d.children ? -6 : 6)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth)
        .text((d, i) => L[i]);

    // --- Adding the legend ---
    addLegend(svg, nodeColor, leafColor, halo, haloWidth)

    return svg.node();
}

function addLegend(svg, nodeColor, leafColor, halo, haloWidth) {
    // Legend parameters
    const legendKeys = [
        {name: "Node", color: nodeColor},
        {name: "Leaf", color: leafColor}
    ];
    let legendRadius = 6;
    let legendSpacing = 4;

    // Legend container
    const legend = svg.append("svg")
        .selectAll(".legendItem")
        .data(legendKeys);

    // Legend icons
    legend.enter()
        .append("circle")
        .attr("cx", legendRadius + 1)
        .attr("cy", legendRadius + 1)
        .attr("r", legendRadius)
        .style("fill", d => d.color)
        .attr("transform",
            (d, i) => {
                let x = 10;
                let y = ((legendRadius * 2) + legendSpacing) * i;
                return `translate(${x}, ${y})`;
            })

    // Legend texts
    legend.enter()
        .append("text")
        .attr('x', (legendRadius * 2) + 15)
        .attr('y', (d, i) => ((legendRadius * 2) + legendSpacing) * i + 11)
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth)
        .text(d => d.name)
}