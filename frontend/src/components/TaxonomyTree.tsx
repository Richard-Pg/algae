"use client";

interface TaxonomyTreeProps {
    taxonomy: {
        kingdom?: string;
        phylum?: string;
        class?: string;
        order?: string;
        family?: string;
        genus?: string;
        species?: string;
    };
}

export default function TaxonomyTree({ taxonomy }: TaxonomyTreeProps) {
    const levels = [
        { rank: "Kingdom", value: taxonomy.kingdom },
        { rank: "Phylum", value: taxonomy.phylum },
        { rank: "Class", value: taxonomy.class },
        { rank: "Order", value: taxonomy.order },
        { rank: "Family", value: taxonomy.family },
        { rank: "Genus", value: taxonomy.genus },
        { rank: "Species", value: taxonomy.species },
    ].filter(l => l.value);

    return (
        <div className="taxonomy-tree">
            {levels.map((level, i) => (
                <div key={level.rank} className="taxonomy-level" style={{ paddingLeft: `${i * 12}px` }}>
                    <div className="taxonomy-dot" />
                    <span className="taxonomy-rank">{level.rank}</span>
                    <span className="taxonomy-name">{level.value}</span>
                </div>
            ))}
        </div>
    );
}
