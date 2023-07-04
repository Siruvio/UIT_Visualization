import {Tree, createLegend} from "./d3TreeScript.js";
import data from "../Data/hierarchyData.json" assert {type: "json"};

export function mapFunction() {
    const nodeClasses = ["nodeNorm", "nodeLeaf", "nodeColl"];

    createLegend(nodeClasses);

    Tree(data, {
        children: d => d.Children,
        width: window.innerWidth,

        nodeCircleRadius: 4,
        nodeNormClass: nodeClasses[0],
        nodeLeafClass: nodeClasses[1],
        nodeCollClass: nodeClasses[2],
    });
}