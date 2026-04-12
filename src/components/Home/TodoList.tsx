import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Todo } from '../../types';
import { Plus, Trash2, Check, X } from 'lucide-react';

interface TodoListProps {
  todos: Todo[];
  loading: boolean;
  onTodoUpdated: () => void;
  searchQuery: string;
}

const TodoList: React.FC<TodoListProps> = ({ todos, loading, onTodoUpdated, searchQuery }) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTodos = todos.filter((todo) => {
    const matchesSearch =
      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (todo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesSearch;
  });

  const visibleTodos = filteredTodos.filter((todo) => {
    if (!todo.completed) return true;
    if (searchQuery) return true;
    if (!todo.completed_at) return true;

    const completedTime = new Date(todo.completed_at).getTime();
    const now = new Date().getTime();
    const hoursPassed = (now - completedTime) / (1000 * 60 * 60);
    return hoursPassed < 24;
  });

  const activeTodos = todos.filter((t) => !t.completed);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('todos').insert([
        {
          title: newTodoTitle.trim(),
          description: newTodoDescription.trim() || null,
          completed: false,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      setNewTodoTitle('');
      setNewTodoDescription('');
      setIsModalOpen(false);
      onTodoUpdated();
    } catch (error) {
      console.error('Error adding todo:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTodo = async (id: string, completed: boolean) => {
    try {
      const completedAt = !completed ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('todos')
        .update({ completed: !completed, completed_at: completedAt })
        .eq('id', id);

      if (error) throw error;
      onTodoUpdated();
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      const { error } = await supabase.from('todos').delete().eq('id', id);

      if (error) throw error;
      onTodoUpdated();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Tasks</h2>
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="mb-6 md:mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Tasks</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTodos.length} active
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          title="Add task"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Todo List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {todos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-gray-300 mb-3">
              <Check className="h-12 w-12 mx-auto opacity-20" />
            </div>
            <p className="text-gray-500 text-sm">No tasks yet. Click the plus button to add one!</p>
          </div>
        ) : visibleTodos.length === 0 ? (
          <div className="text-center py-8 px-4 text-gray-500 text-sm">No tasks match your search.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleTodos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-start gap-3 p-4 transition-all duration-200 group ${
                  todo.completed
                    ? 'bg-green-50 hover:bg-green-100'
                    : 'bg-white hover:bg-blue-50'
                }`}
              >
                <button
                  onClick={() => handleToggleTodo(todo.id, todo.completed)}
                  className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                    todo.completed
                      ? 'bg-green-500 border-green-500 shadow-sm'
                      : 'border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {todo.completed && <Check className="h-4 w-4 text-white" />}
                </button>

                <div className="flex-1 min-w-0 py-0.5">
                  <p
                    className={`text-sm font-medium transition-all ${
                      todo.completed
                        ? 'text-green-700 line-through'
                        : 'text-gray-900'
                    }`}
                  >
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p
                      className={`text-xs transition-all mt-0.5 ${
                        todo.completed
                          ? 'text-green-600 line-through'
                          : 'text-gray-600'
                      }`}
                    >
                      {todo.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Todo Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Task</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTodo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Task
                </label>
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Details (optional)
                </label>
                <textarea
                  value={newTodoDescription}
                  onChange={(e) => setNewTodoDescription(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Add details..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 resize-none transition-all"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTodoTitle.trim() || isSubmitting}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoList;
