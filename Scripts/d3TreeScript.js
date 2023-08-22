// Function resulting from: https://observablehq.com/@d3/collapsible-tree

export function Tree(data, {                                    // "data" is hierarchy (nested objects)
    children,                                                   // Given a d in data, returns its children
    tree = d3.tree,                                             // Layout algorithm (typically d3.tree or d3.cluster)
    diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x),
    width = 640,                                                // Outer width, in pixels
    nodeCircleRadius = 3,                                       // Radius of nodes
    labelSpacing = 7,                                           // Label spacing to node
    nodeNormClass = "",                                         // Class for nodes with children
    nodeLeafClass = "",                                         // Class for nodes without children
    nodeCollClass = "",                                         // Class for collapsed nodes with children
    dndThreshold = 30,                                          // Threshold for drag and drop
    transitionDuration = 500,                                   // Duration for transitions (milliseconds)
} = {}) {

    let root = undefined;
    let infoBox = undefined;
    let clickTimer = undefined;

    const dx = 12;
    let dy = 0;

    let defaultViewBox;


    // --- Main SVG box ---
    const svg = d3.select("#graph")
        .attr("viewBox", [0, -5, width, dx]);

    // --- Stroke group ---
    const gLink = svg.select("#groupStroke");

    // --- Node group ---
    const gNode = svg.select("#groupNode")
        .attr("cursor", "pointer")
        .attr("pointer-events", "all");

    // --- Button in infoBox ---
    const saveButton = document.getElementById("dlButton");
    saveButton.disabled = true;
    saveButton.addEventListener("click", updatedDataSave);

    // Update is called every time the graph is modified
    // (aka on creation, re-creation or if a node is collapsed or opened)
    function graphUpdate(event, source) {
        // Source is undefined only at creation
        if (!source) {
            // We assume that the data is specified as an object {children} with nested objects
            // (a.k.a. the “flare.json” format), and use d3.hierarchy
            root = d3.hierarchy(data, children);
            root.sort((a, b) => d3.ascending(a.data.Name, b.data.Name));

            // Compute the initial layout
            dy = width / (root.height + 1);

            root.x0 = dy / 2;
            root.y0 = 0;
            root.descendants().forEach((d, i) => {
                d.id = i;
                d._children = d.children;
            });

            source = root;
        }

        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout.
        tree().nodeSize([dx, dy])(root);

        let x0 = Infinity, x1 = -x0;
        root.each(d => {            // Getting max and min heights
            if (d.x > x1) x1 = d.x;
            if (d.x < x0) x0 = d.x;
        });

        // Find new left-most and right-most nodes
        let left = root;
        let right = root;
        root.eachBefore(node => {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });
        const height = right.x - left.x + 10;


        defaultViewBox = [-40, left.x - 5, width, height];
        const transition = svg.transition()
            .duration(transitionDuration)
            .attr("viewBox", defaultViewBox)
            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

        // Update the nodes
        const node = gNode.selectAll("g")
            .data(nodes, d => d.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter()
            .append("g")
            .attr("transform", () => `translate(${source.y0},${source.x0})`);

        // OnClick event: check if single or multiple click, then disambiguate function
        nodeEnter.on("click", (event, d) => {
            // Save target element
            const target = event.currentTarget;

            if (clickTimer === undefined) {
                clickTimer = setTimeout(function() { // 300ms timer for more than one click
                    // Timer reset
                    clickTimer = undefined;

                    // Function for single click: infoBox
                    nodeShowInfo(target);
                }, 300);
            } else { // Else is collapse or expand of a node
                // Timer reset
                clearTimeout(clickTimer);
                clickTimer = undefined;

                // If infoBox is opened, delete it
                removeInfoBox()

                if (d._children) {
                    // Change visual children
                    d.children = d.children ? null : d._children;

                    // Change class
                    d3.select(target)
                        .select("circle")
                        .attr("class", d => d.children ? nodeNormClass : nodeCollClass);

                    // Update tree
                    graphUpdate(event, d);

                }
            }
        })

        // OnDrag event: drag a node, eventually updating the underlying structure
        nodeEnter.call(d3.drag()
            .on("start", draggingStart)
            .on("drag", dragging)
            .on("end", draggingEnd)
        );

        nodeEnter.append("circle")
            .attr("r", nodeCircleRadius)
            .attr("class", d => !d._children ? nodeLeafClass : (d.children ? nodeNormClass : nodeCollClass));

        nodeEnter.append("text")
            .attr("class", "nodeLabel")
            .attr("dy", "0.31em")
            .attr("x", d => d._children ? -labelSpacing : labelSpacing)
            .attr("text-anchor", d => d._children ? "end" : "start")
            .text(d => d.data.Name);

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

    // OnStartDrag: set startDragging
    function draggingStart(event, d) {
        // Block dragging for root
        if (d === root) {
            return;
        }

        d.x0 = d.x;
        d.y0 = d.y;

        d.startDragging = true;
    }

    // OnDrag: get current object position and update node position in svg
    // During first "drag" event: hide children nodes and links with parent and all the children
    // Also, move node to the front (moved on dragging bc in draggingStart it absorbs onClick event)
    function dragging(event, d) {
        // Block dragging for root
        if (d === root) {
            return;
        }

        // This block is executed only during the first event "drag"
        if (d.startDragging) {
            // Move the dragged node to the front
            d3.select(this).raise();

            const dHypers = [...d.data.Hypers];
            const dName = d.data.Name;

            const pathList = svg.selectAll("#groupStroke path");    // All the links
            const nodeList = svg.selectAll("#groupNode g");         // All the nodes

            // Delete link between "d" and his parent
            const parentLink = pathList.filter(item => findElementByData(item, item.target.data))
                .filter(function(item) {
                    const itemName = item.target.data.Name;

                    if (itemName === dName) {
                        return item;
                    }
                })
            parentLink.remove();

            // Add name of the current node "d" to list of hypers
            dHypers.push(dName)

            // Delete all children nodes of "d"
            const childrenNodes = nodeList.filter(item => findElementByData(item, item.data)).nodes();
            childrenNodes.forEach(element => {
                d3.select(element).remove();
            })

            // Delete links of all the children nodes
            const childrenLinks = pathList.filter(item => findElementByData(item, item.target.data)).nodes();
            childrenLinks.forEach(element => {
                d3.select(element).remove();
            })

            delete d.startDragging;

            // If infoBox is displayed, remove it
            removeInfoBox()

            // Internal function used in filter
            // Return the item (a node or a link in the graph) only if its data.Hypers fully contains
            //  that of the current node
            function findElementByData(item, itemData) {
                const itemHypers = itemData.Hypers;

                if (itemHypers.length >= dHypers.length &&
                    dHypers.every(v => itemHypers.includes(v))
                ) {
                    return item;
                }
            }
        }

        // Update node coordinates
        d.x += event.dy;
        d.y += event.dx;

        // Update node position
        d3.select(this)
            .attr("transform", `translate(${d.y},${d.x})`);
    }

    // OnEndDrag: get the lowest Euclidean distance between dragged node and all the others in the tree (children of
    // the dragged node are automatically excluded).
    // Get also distance between dragged node and its original position: might have slip during double-click.
    // Then, if some conditions are met, the data structure is updated, and then is the graphical tree;
    // otherwise, revert the dragging.
    function draggingEnd(event, d) {
        // Block dragging for root
        if (d === root) {
            return;
        }

        // Calculate Euclidean distance between dragged node "d" and all the others.
        // Those that fully contains d.Hypers+d.Name are excluded (children of "d"); also "d" is excluded of course.
        const dHypers = [...d.data.Hypers];
        dHypers.push(d.data.Name)

        const distances = root.descendants()
            .map(item => {
                const itemHypers = item.data.Hypers;
                if ((item !== d) &&
                    !(dHypers.every(v => itemHypers.includes(v)))
                ) {
                    const dx = d.x - item.x;
                    const dy = d.y - item.y;
                    return Math.sqrt(dx * dx + dy * dy);
                }
                return Infinity;
            });

        // Get closest node index...
        const minDistance = Math.min(...distances);
        const minDistanceIndex = distances.indexOf(minDistance);

        // ...and then closest node
        const closestNode = root.descendants()[minDistanceIndex];

        // Get node distance from his original position
        const dx = d.x - d.x0;
        const dy = d.y - d.y0;
        const tranDistance = Math.sqrt(dx * dx + dy * dy);

        // Set nodes to work on
        const oldFather = d.parent.data;
        const newFather = closestNode.data;
        const currentNode = d.data;

        // If all are true, update the underlying structure and create the new graph.
        if ((tranDistance > 2) &&           // If true, then it was not a dragging event (less than a minimum slide)
            (minDistance < dndThreshold) && // If true, then "d" is close enough to a possible new father node
            (oldFather !== newFather)) {    // If true, then "newFather" IS a new father

            // Remove child from oldFather node
            let i = oldFather.Children.indexOf(currentNode);
            oldFather.Children.splice(i, 1);

            // Add child in newFather node
            newFather.Children.push(currentNode);

            // Change father in currentNode, from oldFather to newFather
            currentNode.Father = newFather.Name;

            // Change, recursively, Hypers in currentNode and all his children
            let fatherHypers = [...newFather.Hypers];
            fatherHypers.unshift(newFather.Name);
            changeHypers(currentNode, fatherHypers)

            // Update data and remove the old drawn tree. It will be totally re-draw
            data = root.data;
            while (gLink.node().firstChild) {
                gLink.node().firstChild.remove();
            }
            while (gNode.node().firstChild) {
                gNode.node().firstChild.remove();
            }

            // Activate button for save
            saveButton.disabled = false;
            saveButton.innerHTML = "Save updates!";

            // Re-create the whole tree
            graphUpdate(event, null);
        } else {
            // Otherwise, the tree will be restored as before the drag-and-drop.
            if (!(d.startDragging)) {   //This checks if "dragging" has been called at least once
                graphUpdate(event, root);
            } else {
                delete d.startDragging;
            }
        }

        // Recursive function for changing the Hypers in node and his children
        function changeHypers(node, hypers) {
            node.Hypers = hypers;

            let hNext = [...hypers];
            hNext.unshift(node.Name);

            node.Children.forEach(item =>
                changeHypers(item, hNext)
            )
        }
    }

    // Support function: delete infoBox (check function "nodeShowInfo") if present and reset variable
    function removeInfoBox() {
        if (infoBox) {
            infoBox.remove();
            infoBox = undefined;

            // Remove id "activeNode" from the last active node, if any
            const lastActiveNode = document.getElementById("activeNode");
            if (lastActiveNode) {
                lastActiveNode.removeAttribute("id");
            }

            const lastActivePaths = [...document.getElementsByClassName("activePath")];
            if (lastActivePaths) {
                lastActivePaths.forEach(item => item.classList.remove("activePath"));
            }
        }
    }

    // Update top info box with data of clicked node
    function nodeShowInfo(target) {
        // Also moves current node to the front so the box is not under other elements
        const currentNodeGroup = d3.select(target).raise();
        const currentNodeElement = currentNodeGroup.node();
        const currentNodeValues = currentNodeGroup.datum();
        let createBox = true;
        let finalViewBox = svg.attr("viewBox");

        // If a box is displayed, delete it
        if (infoBox) {
            // Revert viewBox, if necessary
            if (svg.attr("viewBox") !== defaultViewBox) {
                finalViewBox = defaultViewBox.toString();
            }

            // Also, if infoBox was in this node, disable new creation (aka, click was for closing it)
            if (currentNodeValues === infoBox.datum()) {
                createBox = false;
            }

            // Remove infoBox
            removeInfoBox();
        }

        // Create the infoBox
        if (createBox) {
            // Add id "activeNode" at the current node
            currentNodeElement.setAttribute("id", "activeNode");

            // Change color for paths to the activeNode
            let targetPaths = [currentNodeValues];
            while (targetPaths.length > 0) {
                const target = targetPaths.shift();

                d3.selectAll("#groupStroke path")
                    .filter(item => item.target === target)
                    .attr("class", "activePath")
                    .each(item => targetPaths.push(item.source));
            }

            // Get node label width
            const labelWidth = currentNodeGroup.select("text").node()
                .getBoundingClientRect().width;

            // Set default box dimension
            let infoBoxWidth = 250;
            let infoboxHeight = 150;

            // Group for infoBox
            infoBox = currentNodeGroup.append("g")
                .attr("id", "iBox");
                //.attr("pointer-events", "none");

            // Add background
            infoBox.append("rect")
                .attr("id", "iBoxBg")
                .attr("x", currentNodeValues._children ? labelSpacing : ((labelSpacing*1.5) + labelWidth))
                .attr("y", -(infoboxHeight / 2))
                .attr("width", infoBoxWidth)
                .attr("height", infoboxHeight);

            // Add infos
            let startTextPos = -63;
            let textToAdd;

            // Text for name
            const infoBoxTextName = infoBox.append("text")
                .attr("x", 12 + (!currentNodeValues._children ? labelWidth + 3 : 0))
                .attr("y", startTextPos);
            textToAdd = "Name: " + currentNodeValues.data.Name;
            infoBoxTextName.text(textToAdd);
            startTextPos += infoBoxTextName.node().getBBox().height + 3; // Update next position

            // Text for synonyms
            const infoBoxTextSynonyms = infoBox.append("text")
                .attr("x", 12 + (!currentNodeValues._children ? labelWidth + 3 : 0))
                .attr("y", startTextPos);
            textToAdd = "Synonyms: " + getValuesForText(currentNodeValues.data.Synonyms);
            infoBoxTextSynonyms.text(textToAdd)
                .call(wrapText, infoBoxWidth - 10);
            startTextPos += infoBoxTextSynonyms.node().getBBox().height + 3; // Update next position

            // Text for verbs
            const infoBoxTextVerbs = infoBox.append("text")
                .attr("x", 12 + (!currentNodeValues._children ? labelWidth + 3 : 0))
                .attr("y", startTextPos);
            textToAdd = "Verbs: " + getValuesForText(currentNodeValues.data.Verbs);
            infoBoxTextVerbs.text(textToAdd)
                .call(wrapText, infoBoxWidth - 10);

            // Change viewBox values if infoBox is out-of-bounds
            // Initialize new viewBox with current one
            let newViewBox = finalViewBox
                .split(",")
                .map(d => parseFloat(d));

            // Get top-left point of node
            const [nodeLeft, nodeTop] = currentNodeGroup.attr("transform")
                .slice(10, -1)
                .split(", ")
                .map(d => parseFloat(d));

            // Check upper border
            const upperLimit = nodeTop - (infoboxHeight / 2);
            if (upperLimit < newViewBox[1]) {
                const difference = upperLimit - newViewBox[1] - 2;
                newViewBox[1] += difference;
                newViewBox[3] -= difference;
            }

            // Check lower border
            const lowerLimit = nodeTop + (infoboxHeight / 2);
            const bottomLine = newViewBox[3] + newViewBox[1];
            if (lowerLimit > bottomLine) {
                newViewBox[3] = lowerLimit - newViewBox[1] + 2;
            }

            // Check right border
            const rightLimit = nodeLeft + currentNodeElement.getBBox().width;
            if (rightLimit > newViewBox[2]) {
                newViewBox[2] = rightLimit;
            }

            finalViewBox = [-40, newViewBox[1], newViewBox[2], newViewBox[3]];

            // Internal function for formatting an array
            function getValuesForText(origin, limit = 40) {
                let possibleText = origin;

                if (possibleText.length > 0) {
                    if (possibleText.length > 50) {
                        const first50 = possibleText.slice(0, limit);
                        const remaining = possibleText.length - limit;

                        possibleText = first50
                            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                            .map(s => s.replace("_", " "))
                            .join(", ");
                        possibleText += ` and ${remaining} more.`;
                    } else {
                        possibleText = possibleText
                            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                            .map(s => s.replace("_", " "))
                            .join(", ");
                    }
                } else {
                    possibleText = "None";
                }

                return possibleText;
            }

            // Internal function for split a string
            function wrapText(text, width) {
                text.each(function () {
                    const text = d3.select(this);
                    const words = text.text().split(" ").reverse();

                    let word;
                    let line = [];
                    let lineNumber = 0;
                    let lineHeight = 1.1;

                    let x = text.attr("x");
                    let y = text.attr("y");
                    let dy = 0;

                    let tspan = text.text(null)
                        .append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", dy + "em");

                    while (word = words.pop()) {
                        line.push(word);
                        tspan.text(line.join(" "));

                        if (tspan.node().getComputedTextLength() > width) {
                            line.pop();
                            tspan.text(line.join(" "));
                            line = [word];

                            tspan = text.append("tspan")
                                .attr("x", x)
                                .attr("y", y)
                                .attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                        }
                    }
                });
            }
        }

        svg.transition()
            .duration(transitionDuration)
            .attr("viewBox", finalViewBox)
            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
    }

    // Function for the save button in the info box
    function updatedDataSave() {
        // Uncomment next line for a faster, but less readable, file
        // const message = JSON.stringify(data);

        // Slower but more human-readable file
        const message = indentedRecursiveSave(data);

        // Create blob for save
        let blob = new Blob([message], {
            type: "text/plain;charset=utf-8",
        });

        const fileName = "hierarchyData_updated.json";

        saveAs(blob, fileName);

        saveButton.disabled = true;
        saveButton.innerHTML = "No updates available";
    }

    // Recursive function for update saving
    function indentedRecursiveSave(infoData, layer = 0) {
        const tabs = "\t".repeat(layer);
        let message = tabs + "{";

        // Name line
        message += "\"Name\": \"" + infoData.Name + "\",\n";

        // Synonyms line
        const synStr = infoData.Synonyms
            .map(syn => "\"" + syn + "\"")
            .join(", ");
        message += tabs + " \"Synonyms\": [" + synStr + "],\n";

        // Hypernyms line
        const hypStr = infoData.Hypers
            .map(syn => "\"" + syn + "\"")
            .join(", ");
        message += tabs + " \"Hypers\": [" + hypStr + "],\n";

        // Verbs line
        const verStr = infoData.Verbs
            .map(syn => "\"" + syn + "\"")
            .join(", ");
        message += tabs + " \"Verbs\": [" + verStr + "],\n";

        //Father line
        message += tabs + " \"Father\": \"" + infoData.Father + "\",\n";

        //Children line (with the recursive call)
        let childrenString;
        if (infoData.Children.length > 0) {
            const childrenMessages = infoData.Children.map(child => {
                return indentedRecursiveSave(child, layer + 1);
            });
            childrenString = "[\n" + childrenMessages.join(",\n") + "\n" + tabs + "]";
        } else {
            childrenString = "[]";
        }
        message += tabs + " \"Children\": " + childrenString + "\n";

        message += tabs + "}";

        return message;
    }

    graphUpdate(null, root);
}

// Add a graphical legend in the top left corner
export function createLegend([nodeNormClass, nodeLeafClass, nodeCollClass]) {
    // Legend parameters
    const legendKeys = [
        {name: "Internal Node", id: nodeNormClass+"Leg"},
        {name: "Leaf Node", id: nodeLeafClass+"Leg"},
        {name: "Collapsed Node", id: nodeCollClass+"Leg"},
        {name: "Active Node", id: "activeNodeLeg"}
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
        .attr("id", d => d.id)
        .text(d => d.name)

    // Set main div height
    const buttonHeight = d3.select("#dlButton").node().offsetHeight;                // Button height
    const svgHeight = ((legendRadius * 2) + legendSpacing) * legendKeys.length;     // SVG height
    d3.select("#extraItems").style("height", (buttonHeight + svgHeight + 5) + "px");// Set height in div
}