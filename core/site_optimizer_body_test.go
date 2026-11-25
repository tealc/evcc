package core

import (
	"encoding/json"
	"testing"

	optimizer "github.com/evcc-io/optimizer/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOptimizerRequestBody(t *testing.T) {
	req := optimizer.OptimizationInput{
		TimeSeries: optimizer.TimeSeries{
			Dt: []int{900, 900, 900},
			Gt: []float32{1, 1, 1},
			Ft: []float32{0, 0, 0},
			PN: []float32{0.3, 0.3, 0.3},
			PE: []float32{0.1, 0.1, 0.1},
		},
		Batteries: []optimizer.BatteryConfig{
			{CMax: 11000, SMax: 60000},
			{CMax: 7000, SMax: 40000},
			{CMax: 3000, SMax: 10000},
		},
	}

	plain, err := json.Marshal(req)
	require.NoError(t, err)

	type battery map[string]any
	parse := func(t *testing.T, body []byte) []battery {
		var res struct {
			Batteries []battery `json:"batteries"`
		}
		require.NoError(t, json.Unmarshal(body, &res))
		return res.Batteries
	}

	t.Run("no absences", func(t *testing.T) {
		body, err := optimizerRequestBody(req, requestDetails{BatteryDetails: make([]batteryDetail, 3)})
		require.NoError(t, err)
		assert.Equal(t, plain, body, "request unchanged")
	})

	t.Run("absences", func(t *testing.T) {
		details := requestDetails{BatteryDetails: []batteryDetail{
			{},
			{CAvail: []float32{1, 0, 0}, EAway: []float32{0, 500, 500.5}},
			{CAvail: []float32{0, 1, 1}},
		}}

		body, err := optimizerRequestBody(req, details)
		require.NoError(t, err)

		bats := parse(t, body)
		require.Len(t, bats, 3)

		assert.NotContains(t, bats[0], "c_avail")
		assert.NotContains(t, bats[0], "e_away")

		assert.Equal(t, []any{1.0, 0.0, 0.0}, bats[1]["c_avail"])
		assert.Equal(t, []any{0.0, 500.0, 500.5}, bats[1]["e_away"])

		assert.Equal(t, []any{0.0, 1.0, 1.0}, bats[2]["c_avail"])
		assert.NotContains(t, bats[2], "e_away")

		// the remaining request is untouched
		assert.Equal(t, 11000.0, bats[0]["c_max"])
		assert.Equal(t, 7000.0, bats[1]["c_max"])
		assert.Equal(t, 3000.0, bats[2]["c_max"])

		var got, want map[string]any
		require.NoError(t, json.Unmarshal(body, &got))
		require.NoError(t, json.Unmarshal(plain, &want))
		assert.Equal(t, want["time_series"], got["time_series"])
	})

	t.Run("wrong length", func(t *testing.T) {
		details := requestDetails{BatteryDetails: []batteryDetail{{CAvail: []float32{1, 0}}}}
		_, err := optimizerRequestBody(req, details)
		assert.Error(t, err)
	})

	t.Run("more details than batteries", func(t *testing.T) {
		details := requestDetails{BatteryDetails: make([]batteryDetail, 5)}
		details.BatteryDetails[0].CAvail = []float32{1, 0, 1}
		_, err := optimizerRequestBody(req, details)
		require.NoError(t, err)
	})
}
