package core

import (
	"encoding/json"
	"fmt"
	"slices"

	optimizer "github.com/evcc-io/optimizer/client"
)

// optimizerRequestBody marshals the optimizer request and adds the vehicle absences from the battery
// details as c_avail and e_away to the matching batteries. The optimizer client does not know these
// fields, but a self-hosted optimizer accepts them. Without absences the body is the plain request.
func optimizerRequestBody(req optimizer.OptimizationInput, details requestDetails) ([]byte, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	if !slices.ContainsFunc(details.BatteryDetails, func(d batteryDetail) bool {
		return d.CAvail != nil || d.EAway != nil
	}) {
		return body, nil
	}

	var doc map[string]json.RawMessage
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, err
	}

	var batteries []map[string]json.RawMessage
	if err := json.Unmarshal(doc["batteries"], &batteries); err != nil {
		return nil, fmt.Errorf("batteries: %w", err)
	}

	for i, d := range details.BatteryDetails {
		if i >= len(batteries) {
			break
		}

		for key, series := range map[string][]float32{"c_avail": d.CAvail, "e_away": d.EAway} {
			if series == nil {
				continue
			}
			if len(series) != len(req.TimeSeries.Dt) {
				return nil, fmt.Errorf("battery %d: %s has %d slots, want %d", i, key, len(series), len(req.TimeSeries.Dt))
			}

			b, err := json.Marshal(series)
			if err != nil {
				return nil, err
			}
			batteries[i][key] = b
		}
	}

	if doc["batteries"], err = json.Marshal(batteries); err != nil {
		return nil, err
	}

	return json.Marshal(doc)
}
