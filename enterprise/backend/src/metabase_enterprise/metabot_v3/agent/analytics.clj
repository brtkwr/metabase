(ns metabase-enterprise.metabot-v3.agent.analytics
  "Analytics and intent-classification helpers for the metabot agent."
  (:require
   [clojure.string :as str]
   [metabase-enterprise.llm.settings :as llm]
   [metabase-enterprise.metabot-v3.self :as self]
   [metabase.analytics.core :as analytics]
   [metabase.api.common :as api]
   [metabase.util.log :as log]))

(set! *warn-on-reflection* true)

(def ^:private user-intents
  [{:intent      "create_or_modify_sql_query"
    :description "User wants to write new SQL from scratch or edit existing SQL"
    :examples    "Write a SQL query to find all orders from last month.; Edit the query to include customer email addresses."}
   {:intent      "fix_broken_sql_query"
    :description "User has broken SQL that needs fixing"
    :examples    "My SQL query is giving an error, can you fix it?; Fix this query."}
   {:intent      "query_data"
    :description "User wants to retrieve or analyze data from a dataset or table"
    :examples    "What are the top 10 customers by revenue?; Show me sales by region."}
   {:intent      "data_discovery"
    :description "User is exploring what data is available, schema, or table structure"
    :examples    "What tables do I have?; What columns are in the orders table?"}
   {:intent      "editing_visualizations"
    :description "User wants to create or modify charts, dashboards, or visual settings"
    :examples    "Change the chart type to bar.; Add a filter to this dashboard."}
   {:intent      "interpret_results"
    :description "User wants help understanding query results or data insights"
    :examples    "What does this data mean?; Why did revenue drop in Q3?"}
   {:intent      "create_dashboard"
    :description "User wants to create a new dashboard or add cards to a dashboard"
    :examples    "Create a dashboard for sales metrics.; Add this chart to my dashboard."}
   {:intent      "navigation"
    :description "User wants to navigate to a specific Metabase page or resource"
    :examples    "Take me to the orders table.; Open the sales dashboard."}
   {:intent      "metabase_help"
    :description "User has a question about how to use Metabase features"
    :examples    "How do I share a dashboard?; How do I set up a subscription?"}
   {:intent      "other"
    :description "Does not fit into any of the above categories"
    :examples    "Hello!; What's the weather?"}])

(def ^:private user-intent-schema
  {:type       "object"
   :properties {:intent {:type "string"
                         :enum ["create_or_modify_sql_query" "fix_broken_sql_query" "query_data"
                                "data_discovery" "editing_visualizations" "interpret_results"
                                "create_dashboard" "navigation" "metabase_help" "other"]}}
   :required             ["intent"]
   :additionalProperties false})

;;; Prompt construction

(defn- render-user-intents-table
  "Render user-intents as a plain-text table."
  []
  (let [header "Intent | Description | Examples"
        sep    "-------|-------------|--------"
        rows   (map (fn [{:keys [intent description examples]}]
                      (str intent " | " description " | " examples))
                    user-intents)]
    (str/join "\n" (concat [header sep] rows))))

(defn- extract-conversation-context
  "Take the last 3 messages and serialize to a plain string."
  [messages]
  (->> (take-last 3 messages)
       (map (fn [{:keys [role content]}]
              (str (name role) ": " content)))
       (str/join "\n")))

(defn- build-intent-prompt [conversation-context]
  (str "You are a user intent classification engine for requests to an AI agent operating on top of Metabase.\n"
       "Given a conversation, classify the user's intent into one of the following categories:\n\n"
       (render-user-intents-table)
       "\n\nThis is the conversation context:\n"
       "<conversation_context>\n"
       conversation-context
       "\n</conversation_context>\n\n"
       "Return a JSON object with a single \"intent\" field containing the category name."))

;;; Classification

(defn classify-user-intent
  "Classify the user's message into one of the intent categories.
  Returns the intent string or nil on failure.
  Does NOT fire token_usage Snowplow events (no :request-id in tracking-opts)."
  [conversation-context]
  (let [prompt (build-intent-prompt conversation-context)
        result (try
                 (self/call-llm-structured
                  (llm/ee-ai-metabot-provider)
                  [{:role "user" :content prompt}]
                  user-intent-schema
                  0.0
                  50
                  {:tag "user-intent"})
                 (catch Exception e
                   (log/warn e "User intent classification failed")
                   nil))]
    (:intent result)))

;;; Snowplow events

(defn track-user-intent!
  "Fire user_intent ai_service_event in a background future.
  No-op if tracking-opts has no :request-id."
  [messages tracking-opts]
  (when (:request-id tracking-opts)
    (let [conversation-context (extract-conversation-context messages)]
      (future
        (try
          (when-let [intent (classify-user-intent conversation-context)]
            (analytics/track-event! :snowplow/ai_service_event
                                    {:hashed-metabase-license-token (analytics/hashed-metabase-token-or-uuid)
                                     :request-id                    (analytics/uuid->ai-service-hex-uuid (:request-id tracking-opts))
                                     :source                        (:source tracking-opts)
                                     :event                         "user_intent"
                                     :user-id                       api/*current-user-id*
                                     :session-id                    (:session-id tracking-opts)
                                     :profile                       (some-> (:profile-name tracking-opts) name)
                                     :event-details                 {"intent" intent}}))
          (catch Exception e
            (log/warn e "Failed to track user intent")))))))
