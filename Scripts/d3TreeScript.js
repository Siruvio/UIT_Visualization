// Function resulting from: https://observablehq.com/@d3/collapsible-tree

export function Tree(data, {                                    // "data" is hierarchy (nested objects)
    children,                                                   // Given a d in data, returns its children
    tree = d3.tree,                                             // Layout algorithm (typically d3.tree or d3.cluster)
    diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x),
    width = 640,                                                // Outer width, in pixels
    nodeCircleRadius = 3,                                       // Radius of nodes
    nodeNormClass = "",                                         // Class for nodes with children
    nodeLeafClass = "",                                         // Class for nodes without children
} = {}) {

    // We assume that the data is specified as an object {children} with nested objects
    // (a.k.a. the “flare.json” format), and use d3.hierarchy
    const root = d3.hierarchy(data, children);

    // Compute the initial layout
    const dx = 12;
    const dy = width / (root.height + 1);

    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if (d.depth > 7) d.children = null;
    });

    // Retrieve top margin offset
    const topMarginOffset = document.getElementById("infoBox").offsetHeight;

    // --- Main SVG box ---
    const svg = d3.select("#graph")
        .attr("viewBox", [0, -5, width, dx])
        .style("margin-top", topMarginOffset + "px");

    // --- Stroke group ---
    const gLink = svg.select("#groupStroke");

    // --- Node group ---
    const gNode = svg.select("#groupNode")
        .attr("cursor", "pointer")
        .attr("pointer-events", "all");

    // OnClick event: display node infos
    gNode.selectAll("g")
        .on("click", (event) => {
        nodeShowInfo(event);
    })

    // Update is called every time the graph is modified (aka a node is collapsed or opened)
    function update(event, source) {
        const duration = 500;
        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout.
        tree().nodeSize([dx, dy])(root);

        let x0 = Infinity, x1 = -x0;
        root.each(d => {            // Getting max and min heights
            if (d.x > x1) x1 = d.x;
            if (d.x < x0) x0 = d.x;
        }).each(d => {              // Adding pads
            d.x -= x0;              // Highest x (negative), moving the upmost x to 0
            d.y += dy / 2 -7;       //Little space to the left
        });

        // Find new left-most and right-most nodes
        let left = root;
        let right = root;
        root.eachBefore(node => {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });
        const height = right.x - left.x + 10;

        const transition = svg.transition()
            .duration(duration)
            .attr("viewBox", [0, left.x - 5, width, height])
            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

        // Update the nodes
        const node = gNode.selectAll("g")
            .data(nodes, d => d.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter()
            .append("g")
            .attr("transform", () => `translate(${source.y0},${source.x0})`)
            //.attr("id", d => `node-${d.id}`)  // Aggiungi l'attributo 'id' al gruppo di nodi
            .on("click", (event) => {
                nodeShowInfo(event);
            })
            .on("dblclick", (event, d) => {
                d.children = d.children ? null : d._children;
                update(event, d);
            });

        nodeEnter.append("circle")
            .attr("r", nodeCircleRadius)
            .attr("class", d => d._children ? nodeNormClass : nodeLeafClass);

        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d._children ? -7 : 7)
            .attr("text-anchor", d => d._children ? "end" : "start")
            .text(d => d.data.Name)
            .clone(true).lower();

        // Transition nodes to their new position.
        node.merge(nodeEnter)
            .transition(transition)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .attr("fill-opacity", 1)
            .attr("stroke-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        node.exit()
            .transition(transition)
            .remove()
            .attr("transform", () => `translate(${source.y},${source.x})`)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0);

        // Update the links…
        const link = gLink.selectAll("path")
            .data(links, d => d.target.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link.enter().append("path")
            .attr("d", () => {
                const o = {x: source.x0, y: source.y0};
                return diagonal({source: o, target: o});
            });

        // Transition links to their new position.
        link.merge(linkEnter).transition(transition)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition(transition).remove()
            .attr("d", () => {
                const o = {x: source.x, y: source.y};
                return diagonal({source: o, target: o});
            });

        // Stash the old positions for transition.
        root.eachBefore(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    update(null, root);
}

// Update top info box with data of clicked node
function nodeShowInfo(event) {
    // Remove id "activeNode" from the last active node, if any
    const lastActive = document.getElementById("activeNode");
    if (lastActive) {
        lastActive.removeAttribute("id");
    }

    // Add id "activeNode" at the current node
    const activeNode = d3.select(event.currentTarget);
    activeNode.node().setAttribute("id", "activeNode");

    // Search the text nodes
    const infoBoxName = document.getElementById("infoTextName");
    const infoBoxSynonyms = document.getElementById("infoTextSynonyms");
    const infoBoxVerbs = document.getElementById("infoTextVerbs");

    // Infos in the node
    const data = activeNode.datum().data;

    // Set the regular expression
    const regEx = /(?<=:<\/b> )/;

    // Overwrite text in the text nodes
    let oldStrName = infoBoxName.innerHTML.split(regEx)[0];
    infoBoxName.innerHTML = oldStrName + data.Name;

    let oldStrSyn = infoBoxSynonyms.innerHTML.split(regEx)[0];
    let textSyn = "";
    if (!(data.Synonyms.length === 0)) {
        let strSyn = data.Synonyms
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .map(s => s.replace("_", " "))
            .join(", ");
        textSyn += strSyn;
    } else {
        textSyn += "None";
    }
    infoBoxSynonyms.innerHTML = oldStrSyn + textSyn;

    let oldStrVer = infoBoxVerbs.innerHTML.split(regEx)[0];
    let textVerbs = "";
    if (!(data.Verbs.length === 0)) {
        let strVer = data.Verbs
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(", ");
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

// Add a graphical legend in the top left corner
export function createLegend([nodeNormClass, nodeLeafClass]) {
    // Legend parameters
    const legendKeys = [
        {name: "Node", id: nodeNormClass+"Leg"},
        {name: "Leaf", id: nodeLeafClass+"Leg"},
        {name: "Active", id: "activeNodeLeg"}
    ];
    let legendRadius = 6;
    let legendSpacing = 5;

    // Legend container
    const legend = d3.select("#groupLegend")
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
        .text(d => d.name)
}