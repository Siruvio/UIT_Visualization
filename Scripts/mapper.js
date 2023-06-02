import {Tree} from "./d3TreeScript.js";
import data from "../Data/hierarchyData.json" assert {type: "json"};

function mapper() {
    let tree = Tree(data, {
        children: d => d.Children,
        label: d => d.Name,
        title: null,
        //title: (d, n) => `${n.ancestors().reverse().map(d => d.data.Name).join(".")}`, // hover text
        link: null,
        width: 1152
    })

    return document.body.appendChild(tree);
}

window.mapFunction = mapper()