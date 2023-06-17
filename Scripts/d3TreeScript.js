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
    nodeCollClass = "",             // Class for nodes visually collapsed
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

    // Retrieving top margin offset
    const topMarginOffset = document.getElementById("infoBox").offsetHeight;

    // Use the required curve
    if (typeof curve !== "function") throw new Error(`Unsupported curve`);

    // --- Main SVG box ---
    const svg = d3.create("svg")
        .attr("id", "graph")
        .attr("viewBox", [0, -dx, width, height])
        .attr("width", width)
        .attr("height", height)
        .style("margin-top", topMarginOffset + "px");

    // --- Adding legend ---
    addLegend(svg, halo, haloWidth, nodeNormClass, nodeLeafClass, nodeCollClass);

    // --- Curved strokes of tree ---
    svg.append("g")
        .attr("id", "groupStroke")
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
        .attr("id", "groupNode")
        .selectAll("a")
        .data(root.descendants())
        .join("a")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // OnClick event: display node infos
    node.on("click", function(event) {
       nodeShowInfo(event, this);
    })

    // OnDoubleClick event: "collapse" children of node
    node.on("dblclick", function (event) {
        nodeVisualCollapse(event, this, nodeLeafClass, nodeNormClass, nodeCollClass);
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

// Add a graphical legend in the top left corner
function addLegend(svg, halo, haloWidth, nodeNormClass, nodeLeafClass, nodeCollClass) {
    // Legend parameters
    const legendKeys = [
        {name: "Node", id: nodeNormClass+"Leg"},
        {name: "Leaf", id: nodeLeafClass+"Leg"},
        {name: "Collapsed", id: nodeCollClass+"Leg"},
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

// Update top info box with data of clicked node
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
    const data = d3.select(node).datum().data;

    // Set the regular expression
    const regEx = /(?<=:<\/b> )/;

    // Overwrite text in the text nodes
    let oldStrName = infoBoxName.innerHTML.split(regEx)[0];
    infoBoxName.innerHTML = oldStrName + data.Name;

    let oldStrSyn = infoBoxSynonyms.innerHTML.split(regEx)[0];
    let textSyn = "";
    if (!(data.Synonyms.length === 0)) {
        let strSyn = data.Synonyms.toString()
            .replaceAll(",", ", ");
        textSyn += strSyn;
    } else {
        textSyn += "None";
    }
    infoBoxSynonyms.innerHTML = oldStrSyn + textSyn;

    let oldStrVer = infoBoxVerbs.innerHTML.split(regEx)[0];
    let textVerbs = "";
    if (!(data.Verbs.length === 0)) {
        let strVer = data.Verbs.toString()
            .replaceAll(",", ", ");
        textVerbs += strVer;
    } else {
        textVerbs += "None";
    }
    infoBoxVerbs.innerHTML = oldStrVer + textVerbs;

    // Updated the different fields, edit the margin of svg correctly to avoid overlapping
    const topMarginOffset = document.getElementById("infoBox").offsetHeight;
    const graphSvg = d3.select("#graph");
    graphSvg.style("margin-top", topMarginOffset + "px");
}

// Collapse a node when double-clicked, or reopen a collapsed node
// A collapsed node can be distinguished by its color (refer to styles.css file)
function nodeVisualCollapse(event, node, nodeLeafClass, nodeNormClass, nodeCollClass) {
    const nodeCircle = node.querySelector("circle");    // Get current node icon
    const nodeClass = nodeCircle.getAttribute("class"); // Get current node class
    const nodeData = d3.select(node).datum().data;      // Get current node data

    if (!(nodeClass === nodeLeafClass)) {
        const nodeHypers = [...nodeData.Hypers];        // Create new array with Hypers of node
        nodeHypers.push(nodeData.Name);                 // Add node name to the list

        // Get container with all nodes,
        // then save in filteredNodes only those that are his children (in data)
        const nodes = d3.selectAll("#groupNode a");
        const filteredNodes = [];
        nodes.each(function() {
            const currentNode = d3.select(this);
            const currentData = currentNode.datum().data;
            const currentHypers = currentData.Hypers;

            if (
                currentHypers.length >= nodeHypers.length &&
                nodeHypers.every(v => currentHypers.includes(v))
            ) {
                filteredNodes.push(currentNode);
            }
        });

        // Get container with all strokes,
        // then save in filteredStrokes only those that have source in one of the filteredNodes
        const strokes = d3.selectAll("#groupStroke path");
        const filteredStrokes = [];
        strokes.each(function() {
            const currentStroke = d3.select(this);
            const currentData = currentStroke.datum().target.data;
            const currentHypers = currentData.Hypers;

            if (
                currentHypers.length >= nodeHypers.length &&
                nodeHypers.every(v => currentHypers.includes(v))
            ) {
                filteredStrokes.push(currentStroke);
            }
        });

        switch (nodeClass) {
            case nodeNormClass:
                nodeCircle.setAttribute("class", nodeCollClass);    // Change main node color

                filteredNodes.forEach(element => {                  // Set children nodes visibility
                    element.attr("display", "none");
                })

                filteredStrokes.forEach(element => {                // Set children strokes visbility
                    element.attr("display", "none");
                })
                break;
            case nodeCollClass:
                nodeCircle.setAttribute("class", nodeNormClass);    // Change main node color

                filteredNodes.forEach(element => {                  // Set children nodes visibility
                    element.attr("display", null);

                    // Special case: if a collapsed node has been collapsed in another node,
                    // then it will be reverted as open.
                    const elementCircle = element.select("circle");
                    const elementClass = elementCircle.attr("class");
                    if (elementClass === nodeCollClass) {
                        elementCircle.attr("class", nodeNormClass);
                    }
                })

                filteredStrokes.forEach(element => {                // Set children strokes visbility
                    element.attr("display", null);
                })
                break;
            default:
                console.log("NodeClass Error");
        }
    }
}